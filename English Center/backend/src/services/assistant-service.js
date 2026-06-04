function normalizeTextForChat(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/Ä'/g, 'd')
    .replace(/Ä/g, 'd')
    .toLowerCase();
}

function assistantFallbackReply(messages) {
  const last = messages.slice().reverse().find(item => item && item.role === 'user');
  const text = normalizeTextForChat(last ? last.content : '');
  let reply = 'Xin chào! Tôi chưa hiểu rõ câu hỏi. Bạn có thể hỏi về khóa học, học phí, giáo viên, lịch học hoặc đăng ký để tôi tư vấn nhanh hơn.';
  if (text.includes('hoc phi') || text.includes('gia') || text.includes('phi')) {
    reply = 'Học phí tùy theo khóa học. Bạn có thể xem trang Học phí hoặc nói mục tiêu điểm số, tôi sẽ gợi ý khóa phù hợp.';
  } else if (text.includes('giao vien') || text.includes('teacher') || text.includes('thay') || text.includes('co ')) {
    reply = 'English Center có đội ngũ giáo viên luyện thi THPTQG theo từng mục tiêu điểm. Bạn có thể xem trang Giáo viên để chọn giáo viên phù hợp.';
  } else if (text.includes('dang ky') || text.includes('register') || text.includes('enroll')) {
    reply = 'Bạn nhấn Đăng Ký, tạo tài khoản học sinh, sau đó chọn khóa học và xác nhận ghi danh. Hệ thống sẽ đưa bạn vào dashboard học sinh.';
  } else if (text.includes('test') || text.includes('trinh do') || text.includes('kiem tra')) {
    reply = 'English Center có hệ thống đề thi thử online để kiểm tra trình độ. Bạn có thể vào trang Đề thi thử để làm bài miễn phí.';
  } else if (text.includes('khoa') || text.includes('course')) {
    reply = 'English Center có các khóa: Nền tảng, Luyện đề, Cấp tốc, Từ vựng theo chủ đề, Phát âm AI và Nâng cao. Hãy nói mục tiêu điểm hiện tại để tôi gợi ý!';
  }
  return reply;
}

function extractAssistantText(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (typeof data.reply === 'string') return data.reply;
  if (typeof data.text === 'string') return data.text;
  if (typeof data.message === 'string') return data.message;
  if (data.message && typeof data.message.content === 'string') return data.message.content;
  if (Array.isArray(data.content) && data.content[0] && typeof data.content[0].text === 'string') return data.content[0].text;
  if (Array.isArray(data.choices) && data.choices[0]) {
    return data.choices[0].message?.content || data.choices[0].text || '';
  }
  if (Array.isArray(data.candidates) && data.candidates[0]) {
    const parts = data.candidates[0].content?.parts || [];
    return parts.map(part => part.text || '').join('').trim();
  }
  return '';
}

async function callAssistantService(payload) {
  const url = process.env.ASSISTANT_API_URL || process.env.CHAT_API_URL || '';
  if (!url) return '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.ASSISTANT_API_TIMEOUT_MS || 12000));
  try {
    const headers = { 'Content-Type': 'application/json' };
    const key = process.env.ASSISTANT_API_KEY || process.env.CHAT_API_KEY || '';
    if (key) headers.Authorization = `Bearer ${key}`;
    if (process.env.ASSISTANT_API_HEADER_NAME && process.env.ASSISTANT_API_HEADER_VALUE) {
      headers[process.env.ASSISTANT_API_HEADER_NAME] = process.env.ASSISTANT_API_HEADER_VALUE;
    }
    const response = await fetch(url, {
      method: process.env.ASSISTANT_API_METHOD || 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Assistant service ${response.status}: ${text.slice(0, 200)}`);
    let data = text;
    try {
      data = JSON.parse(text);
    } catch (_) {}
    return extractAssistantText(data);
  } finally {
    clearTimeout(timeout);
  }
}

async function callDeepSeek(systemPrompt, messages) {
  const key = process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || '';
  if (!key || key === 'your_api_key_here') return '';
  const model = process.env.AI_MODEL || process.env.DEEPSEEK_MODEL || 'gpt-4o-mini';
  const url = process.env.AI_API_URL || process.env.DEEPSEEK_API_URL || 'https://api.openai.com/v1/chat/completions';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') }))
        ],
        max_tokens: 600,
        temperature: 0.7,
        stream: false
      }),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`DeepSeek ${response.status}: ${text.slice(0, 300)}`);
    const data = JSON.parse(text);
    return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
  } catch (err) {
    console.warn('[DeepSeek] error:', err.message);
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  assistantFallbackReply,
  callAssistantService,
  extractAssistantText,
  callDeepSeek
};
