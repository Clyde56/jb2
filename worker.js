// Cloudflare Worker API 后端
// 处理用户认证和数据存储

// 简单的用户认证和数据存储
// 注意：这是一个简化版本，生产环境需要更严格的安全措施

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 设置CORS头
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    // 处理预检请求
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: corsHeaders
        });
    }
    
    try {
        // API路由
        if (path === '/api/register' && request.method === 'POST') {
            return await handleRegister(request);
        } else if (path === '/api/login' && request.method === 'POST') {
            return await handleLogin(request);
        } else if (path === '/api/data') {
            if (request.method === 'GET') {
                return await handleGetData(request);
            } else if (request.method === 'POST') {
                return await handleSaveData(request);
            }
        }
        
        // 未知路由
        return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Worker error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// 用户注册
async function handleRegister(request) {
    try {
        const { username, password } = await request.json();
        
        if (!username || !password) {
            return jsonResponse({ error: '用户名和密码不能为空' }, 400);
        }
        
        if (username.length < 3 || username.length > 20) {
            return jsonResponse({ error: '用户名长度应为3-20个字符' }, 400);
        }
        
        if (password.length < 6) {
            return jsonResponse({ error: '密码长度至少为6位' }, 400);
        }
        
        // 检查用户是否已存在
        const existingUser = await OVERTIME_DATA.get(`user:${username}`);
        if (existingUser) {
            return jsonResponse({ error: '用户名已存在' }, 409);
        }
        
        // 创建用户（使用简单的哈希，生产环境应使用更安全的方案）
        const userData = {
            username,
            passwordHash: await simpleHash(password),
            createdAt: new Date().toISOString()
        };
        
        // 保存用户数据
        await OVERTIME_DATA.put(`user:${username}`, JSON.stringify(userData));
        
        return jsonResponse({ message: '注册成功' });
    } catch (error) {
        return jsonResponse({ error: '注册失败' }, 500);
    }
}

// 用户登录
async function handleLogin(request) {
    try {
        const { username, password } = await request.json();
        
        if (!username || !password) {
            return jsonResponse({ error: '用户名和密码不能为空' }, 400);
        }
        
        // 获取用户数据
        const userData = await OVERTIME_DATA.get(`user:${username}`);
        if (!userData) {
            return jsonResponse({ error: '用户不存在' }, 404);
        }
        
        const user = JSON.parse(userData);
        
        // 验证密码
        const inputHash = await simpleHash(password);
        if (inputHash !== user.passwordHash) {
            return jsonResponse({ error: '密码错误' }, 401);
        }
        
        // 生成访问令牌（使用简单的时间戳+随机数，生产环境应使用JWT）
        const token = generateToken(username);
        
        // 保存令牌（设置30天过期）
        await OVERTIME_DATA.put(`token:${token}`, username, { expirationTtl: 60 * 60 * 24 * 30 });
        
        return jsonResponse({ 
            token,
            username,
            message: '登录成功'
        });
    } catch (error) {
        return jsonResponse({ error: '登录失败' }, 500);
    }
}

// 获取用户数据
async function handleGetData(request) {
    try {
        const token = getTokenFromRequest(request);
        if (!token) {
            return jsonResponse({ error: '未授权访问' }, 401);
        }
        
        // 验证令牌
        const username = await OVERTIME_DATA.get(`token:${token}`);
        if (!username) {
            return jsonResponse({ error: '令牌无效或已过期' }, 401);
        }
        
        // 获取用户数据
        const userData = await OVERTIME_DATA.get(`data:${username}`);
        const data = userData ? JSON.parse(userData) : {};
        
        return jsonResponse({ data });
    } catch (error) {
        return jsonResponse({ error: '获取数据失败' }, 500);
    }
}

// 保存用户数据
async function handleSaveData(request) {
    try {
        const token = getTokenFromRequest(request);
        if (!token) {
            return jsonResponse({ error: '未授权访问' }, 401);
        }
        
        // 验证令牌
        const username = await OVERTIME_DATA.get(`token:${token}`);
        if (!username) {
            return jsonResponse({ error: '令牌无效或已过期' }, 401);
        }
        
        const newData = await request.json();
        
        // 验证数据格式（简单验证）
        if (typeof newData !== 'object' || newData === null) {
            return jsonResponse({ error: '数据格式无效' }, 400);
        }
        
        // 保存数据
        await OVERTIME_DATA.put(`data:${username}`, JSON.stringify(newData));
        
        return jsonResponse({ message: '数据保存成功' });
    } catch (error) {
        return jsonResponse({ error: '保存数据失败' }, 500);
    }
}

// 辅助函数
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

function getTokenFromRequest(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7);
}

async function simpleHash(str) {
    // 简单的哈希函数，生产环境应使用更安全的方案如bcrypt
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateToken(username) {
    // 生成简单的令牌（时间戳 + 随机数）
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `${timestamp}-${random}-${username}`;
}
