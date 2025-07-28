import crypto from 'crypto';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// 環境変数
const BOT_SECRET = process.env.BOT_SECRET;
const SERVER_API_CONSUMER_KEY = process.env.SERVER_API_CONSUMER_KEY;
const SERVER_TOKEN = process.env.SERVER_TOKEN;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const BOT_ID = process.env.BOT_ID;

// グローバル変数
let productsData = [];
let userStates = {}; // ユーザーごとの会話状態を管理

// CSV読み込み関数
function loadProductsData() {
  try {
    const csvPath = path.join(process.cwd(), 'public', 'products.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    
    // 簡易CSV パース
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');
    
    productsData = lines.slice(1).map(line => {
      const values = line.split(',');
      const obj = {};
      headers.forEach((header, index) => {
        obj[header.trim()] = values[index] ? values[index].trim() : '';
      });
      return obj;
    });
    
    console.log(`商品データを${productsData.length}件読み込みました`);
    return true;
  } catch (error) {
    console.error('CSV読み込みエラー:', error);
    return false;
  }
}

// 初期化時にCSVを読み込み
loadProductsData();

// JWT生成関数（元のまま）
function generateJWT() {
  // 実際の実装では、RS256でJWTを生成
  // ここは簡略化されています
  return 'your-jwt-token';
}

// メッセージ送信関数（元のまま）
async function sendMessage(channelId, content) {
  try {
    const jwt = generateJWT();
    const response = await axios.post(
      `https://www.worksapis.com/v1.0/bots/${BOT_ID}/channels/${channelId}/messages`,
      {
        content: {
          type: 'text',
          text: content
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('メッセージ送信エラー:', error);
  }
}

// Webhook検証（元のまま）
function verifySignature(body, signature) {
  if (!BOT_SECRET || !signature) return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', BOT_SECRET)
    .update(JSON.stringify(body))
    .digest('base64');
  
  return expectedSignature === signature;
}

// ユーザー状態の初期化
function initUserState(userId) {
  userStates[userId] = {
    step: 'initial',
    brand: null,
    model: null,
    capacity: null
  };
}

// ユーザー状態の取得
function getUserState(userId) {
  if (!userStates[userId]) {
    initUserState(userId);
  }
  return userStates[userId];
}

// 商品検索関数
function searchProducts(filters) {
  return productsData.filter(product => {
    return Object.keys(filters).every(key => {
      if (!filters[key]) return true;
      return product[key] && product[key].toString().toLowerCase().includes(filters[key].toLowerCase());
    });
  });
}

// ブランド一覧取得
function getAvailableBrands() {
  const brands = [...new Set(productsData.map(p => p.brand))];
  return brands;
}

// 機種一覧取得
function getAvailableModels(brand) {
  const models = [...new Set(productsData
    .filter(p => p.brand.toLowerCase() === brand.toLowerCase())
    .map(p => p.model))];
  return models;
}

// 容量一覧取得
function getAvailableCapacities(brand, model) {
  const capacities = [...new Set(productsData
    .filter(p => 
      p.brand.toLowerCase() === brand.toLowerCase() && 
      p.model.toString().toLowerCase() === model.toLowerCase()
    )
    .map(p => p.capacity))];
  return capacities;
}

// 会話処理メイン関数（新規追加）
function processMessage(messageText, userId) {
  const text = messageText.toLowerCase().trim();
  const userState = getUserState(userId);
  
  // 会話をリセット
  if (text.includes('リセット') || text.includes('最初から')) {
    initUserState(userId);
    return 'リセットしました。何かお探しのスマホはありますか？😊';
  }
  
  // 発売日に関する質問
  if (text.includes('いつ') || text.includes('発売日') || text.includes('発売')) {
    if (userState.brand && userState.model) {
      const product = searchProducts({
        brand: userState.brand,
        model: userState.model
      })[0];
      if (product) {
        return `${userState.brand} ${userState.model}の発売日は${product.releaseday}です📅`;
      }
    }
    return '機種を教えてください。発売日をお調べします📅';
  }
  
  // 初期状態または商品検索開始
  if (userState.step === 'initial') {
    if (text.includes('おすすめ') || text.includes('スマホ') || text.includes('探し') || text.includes('欲しい')) {
      userState.step = 'brand_selection';
      const brands = getAvailableBrands();
      return `どちらのブランドをお探しですか？\n${brands.join('？ ')}？😊`;
    }
    
    // 直接ブランド名が言われた場合
    const brands = getAvailableBrands();
    const matchedBrand = brands.find(brand => text.includes(brand.toLowerCase()));
    if (matchedBrand) {
      userState.brand = matchedBrand;
      userState.step = 'model_selection';
      const models = getAvailableModels(matchedBrand);
      return `${matchedBrand}ですね！どちらの機種をお探しですか？\n${models.join(', ')}はいかがでしょうか📱`;
    }
    
    return 'こんにちは！おすすめのスマホをお探しですか？😊';
  }
  
  // ブランド選択段階
  if (userState.step === 'brand_selection') {
    const brands = getAvailableBrands();
    const selectedBrand = brands.find(brand => text.includes(brand.toLowerCase()));
    
    if (selectedBrand) {
      userState.brand = selectedBrand;
      userState.step = 'model_selection';
      const models = getAvailableModels(selectedBrand);
      return `${selectedBrand}ですね！どちらの機種をお探しですか？\n${models.join(', ')}はいかがでしょうか📱`;
    }
    
    return `申し訳ございません。${brands.join('？ ')}？のどちらでしょうか🤔`;
  }
  
  // 機種選択段階
  if (userState.step === 'model_selection') {
    const models = getAvailableModels(userState.brand);
    const selectedModel = models.find(model => text.includes(model.toString().toLowerCase()));
    
    if (selectedModel) {
      userState.model = selectedModel;
      userState.step = 'capacity_selection';
      const capacities = getAvailableCapacities(userState.brand, selectedModel);
      return `${userState.brand} ${selectedModel}ですね！容量はいかがですか？\n${capacities.join(', ')}がございます💾`;
    }
    
    return `申し訳ございません。${models.join(', ')}のどちらでしょうか🤔`;
  }
  
  // 容量選択段階
  if (userState.step === 'capacity_selection') {
    const capacities = getAvailableCapacities(userState.brand, userState.model);
    const selectedCapacity = capacities.find(capacity => text.includes(capacity.toLowerCase()));
    
    if (selectedCapacity) {
      userState.capacity = selectedCapacity;
      
      // 商品検索して価格表示
      const product = searchProducts({
        brand: userState.brand,
        model: userState.model,
        capacity: selectedCapacity
      })[0];
      
      if (product) {
        const price = parseInt(product.price).toLocaleString();
        const response = `${userState.brand} ${userState.model} (${selectedCapacity})の価格は\n💰 ${price}円 です！\n\n発売日: ${product.releaseday}📅\n\n他にも何かお探しでしたら「リセット」と言ってください😊`;
        
        // 状態をリセット
        initUserState(userId);
        return response;
      }
    }
    
    return `申し訳ございません。${capacities.join(', ')}のどちらでしょうか🤔`;
  }
  
  // デフォルトの応答
  return `「${messageText}」ですね。スマホをお探しでしたら「おすすめ」と言ってください😊`;
}

// Vercel関数のメインハンドラー（元のWebhook構造のまま）
export default async function handler(req, res) {
  // CORS対応
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-works-signature');

  // OPTIONSリクエスト対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GETリクエスト（テスト用）
  if (req.method === 'GET') {
    return res.status(200).json({ 
      message: 'CSV対応チャットボット稼働中！',
      productsCount: productsData.length,
      timestamp: new Date().toISOString()
    });
  }

  // POSTリクエスト（実際のWebhook）
  if (req.method === 'POST') {
    try {
      console.log('Webhook受信:', req.body);

      // 署名検証（一時的にスキップ）
      // const signature = req.headers['x-works-signature'];
      // if (!verifySignature(req.body, signature)) {
      //   return res.status(401).json({ error: 'Unauthorized' });
      // }

      // 直接メッセージ形式の場合
      if (req.body.type === 'message' && req.body.content?.type === 'text') {
        const userId = req.body.source?.userId;
        const messageText = req.body.content.text;
        
        console.log(`受信メッセージ (直接形式) (${userId}): ${messageText}`);
        
        if (userId) {
          // CSV読み込みが失敗している場合は再読み込み
          if (productsData.length === 0) {
            loadProductsData();
          }
          
          // 新しい会話処理を使用
          const replyMessage = processMessage(messageText, userId);
          
          // 返信送信（userIdをchannelIdとして使用）
          await sendMessage(userId, replyMessage);
        }
        
        return res.status(200).json({ status: 'OK' });
      }

      // 従来のevents形式も念のためサポート
      const events = req.body.events || [];

      for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
          const channelId = event.source?.channelId;
          const userId = event.source?.userId || channelId;
          const messageText = event.message.text;

          console.log(`受信メッセージ (${userId}): ${messageText}`);

          if (channelId) {
            // CSV読み込みが失敗している場合は再読み込み
            if (productsData.length === 0) {
              loadProductsData();
            }

            // 新しい会話処理を使用
            const replyMessage = processMessage(messageText, userId);

            // 返信送信
            await sendMessage(channelId, replyMessage);
          }
        }
      }

      return res.status(200).json({ status: 'OK' });
    } catch (error) {
      console.error('Webhook処理エラー:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // その他のメソッド
  return res.status(405).json({ error: 'Method Not Allowed' });
}
