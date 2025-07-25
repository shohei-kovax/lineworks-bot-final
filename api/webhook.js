import axios from 'axios';
import crypto from 'crypto';

// 環境変数
const BOT_SECRET = process.env.BOT_SECRET;
const BOT_ID = process.env.BOT_ID;
const SERVER_API_CONSUMER_KEY = process.env.SERVER_API_CONSUMER_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// JWT生成関数（簡略版）
function generateJWT() {
  // 実際の実装では、RS256でJWTを生成
  // 今はテスト用の固定値
  return 'test-jwt-token';
}

// メッセージ送信関数
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
    console.log('メッセージ送信成功:', response.data);
    return response.data;
  } catch (error) {
    console.error('メッセージ送信エラー:', error.response?.data || error.message);
    return null;
  }
}

// Webhook検証
function verifySignature(body, signature) {
  if (!BOT_SECRET || !signature) {
    console.log('署名検証スキップ: BOT_SECRET または signature が未設定');
    return true; // 開発時はスキップ
  }
  
  try {
    const expectedSignature = crypto
      .createHmac('sha256', BOT_SECRET)
      .update(JSON.stringify(body))
      .digest('base64');
    
    return expectedSignature === signature;
  } catch (error) {
    console.error('署名検証エラー:', error);
    return false;
  }
}

// 会話ロジック
function processMessage(messageText) {
  const text = messageText.toLowerCase();
  
  if (text.includes('こんにちは') || text.includes('hello')) {
    return 'こんにちは！今日はいい天気ですね😊';
  }
  
  if (text.includes('天気')) {
    return '申し訳ございませんが、リアルタイムの天気情報は取得できません。天気予報アプリをご確認ください🌤️';
  }
  
  if (text.includes('時間')) {
    const now = new Date();
    return `現在の時刻は ${now.toLocaleString('ja-JP')} です⏰`;
  }
  
  if (text.includes('ありがとう')) {
    return 'どういたしまして！他にも何かお手伝いできることがあれば、お気軽にお声かけください✨';
  }
  
  if (text.includes('バイバイ') || text.includes('さようなら')) {
    return 'さようなら！また今度お話ししましょう👋';
  }
  
  if (text.includes('テスト')) {
    return 'テストメッセージを受信しました！Bot は正常に動作しています🤖';
  }
  
  // デフォルトの応答
  return `「${messageText}」ですね。面白いお話ですね！もっと詳しく教えてください😄`;
}

// メインハンドラー関数
export default async function handler(req, res) {
  // CORS対応
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-works-signature');

  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);

  // OPTIONSリクエスト対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GETリクエスト（動作確認用）
  if (req.method === 'GET') {
    return res.status(200).json({ 
      message: 'LINE WORKS Bot is working!',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      endpoints: {
        webhook: '/api/webhook (POST)',
        health: '/api/webhook (GET)'
      }
    });
  }

  // POSTリクエスト（実際のWebhook）
  if (req.method === 'POST') {
    try {
      console.log('=== Webhook受信 ===');
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      console.log('Body:', JSON.stringify(req.body, null, 2));
      
      // 署名検証
      const signature = req.headers['x-works-signature'];
      if (!verifySignature(req.body, signature)) {
        console.error('署名検証失敗');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const events = req.body?.events || [];
      console.log(`イベント数: ${events.length}`);
      
      for (const event of events) {
        console.log('イベントタイプ:', event.type);
        
        if (event.type === 'message' && event.message?.type === 'text') {
          const channelId = event.source?.channelId;
          const messageText = event.message.text;
          
          console.log(`受信メッセージ: "${messageText}"`);
          console.log(`チャンネルID: ${channelId}`);
          
          if (channelId && messageText) {
            // 会話処理
            const replyMessage = processMessage(messageText);
            console.log(`返信メッセージ: "${replyMessage}"`);
            
            // 返信送信
            const sendResult = await sendMessage(channelId, replyMessage);
            if (sendResult) {
              console.log('返信送信成功');
            } else {
              console.log('返信送信失敗');
            }
          } else {
            console.log('チャンネルIDまたはメッセージテキストが不正');
          }
        }
      }
      
      console.log('=== Webhook処理完了 ===');
      return res.status(200).json({ 
        status: 'OK',
        processedEvents: events.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('=== Webhook処理エラー ===');
      console.error('Error:', error);
      return res.status(500).json({ 
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // その他のメソッド
  return res.status(405).json({ 
    error: 'Method Not Allowed',
    allowedMethods: ['GET', 'POST', 'OPTIONS']
  });
}
