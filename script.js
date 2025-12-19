// 加班记录系统 - 前端逻辑
// 使用Cloudflare Workers + KV实现数据同步

class OvertimeTracker {
    constructor() {
        this.currentDate = new Date();
        this.overtimeData = {};
        this.currentUser = null;
        this.userToken = null;
        this.lastSyncTime = null;
        this.isSyncing = false;
        
        // API端点配置
        this.API_BASE_URL = ' https://jiaban.2442422196155.workers.dev/';
        // 注意：实际部署时需要替换为你的Worker域名
        
        this.init();
    }
    
    init() {
        this.loadUserFromStorage();
        this.setupEventListeners();
        this.checkAuthStatus();
    }
    
    loadUserFromStorage() {
        // 从localStorage加载用户信息
        const savedUser = localStorage.getItem('overtime_user');
        const savedToken = localStorage.getItem('overtime_token');
        const savedData = localStorage.getItem('overtime_data');
        
        if (savedUser && savedToken) {
            this.currentUser = JSON.parse(savedUser);
            this.userToken = savedToken;
        }
        
        if (savedData) {
            this.overtimeData = JSON.parse(savedData);
        }
    }
    
    setupEventListeners() {
        // 月份导航
        document.getElementById('prev-month').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('next-month').addEventListener('click', () => this.changeMonth(1));
        document.getElementById('reset-month').addEventListener('click', () => this.resetCurrentMonth());
        document.getElementById('sync-btn').addEventListener('click', () => this.syncData());
        
        // 导出导入
        document.getElementById('export-data').addEventListener('click', () => this.exportData());
        document.getElementById('import-data').addEventListener('click', () => document.getElementById('file-input').click());
        document.getElementById('file-input').addEventListener('change', (e) => this.importData(e));
        
        // 退出登录
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        
        // 登录注册表单
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });
        
        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.register();
        });
        
        // 标签切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchAuthTab(tab);
            });
        });
        
        // 关闭模态框
        document.querySelector('.close-modal').addEventListener('click', () => {
            document.getElementById('auth-modal').style.display = 'none';
        });
        
        // 点击模态框外部关闭
        document.getElementById('auth-modal').addEventListener('click', (e) => {
            if (e.target.id === 'auth-modal') {
                document.getElementById('auth-modal').style.display = 'none';
            }
        });
    }
    
    checkAuthStatus() {
        if (this.currentUser && this.userToken) {
            this.showMainApp();
            this.renderCalendar();
            this.syncData(); // 自动同步数据
        } else {
            this.showAuthModal();
        }
    }
    
    showAuthModal() {
        document.getElementById('auth-modal').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
    
    showMainApp() {
        document.getElementById('auth-modal').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        document.getElementById('current-user').textContent = this.currentUser.username;
    }
    
    switchAuthTab(tab) {
        // 切换登录/注册标签
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.toggle('active', form.id === `${tab}-form`);
        });
        
        // 清空消息
        document.getElementById('login-message').textContent = '';
        document.getElementById('register-message').textContent = '';
    }
    
    async login() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value.trim();
        
        if (!username || !password) {
            this.showMessage('login-message', '请输入用户名和密码', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentUser = { username };
                this.userToken = data.token;
                
                // 保存到localStorage
                localStorage.setItem('overtime_user', JSON.stringify(this.currentUser));
                localStorage.setItem('overtime_token', this.userToken);
                
                this.showMessage('login-message', '登录成功！正在同步数据...', 'success');
                
                // 延迟显示主界面并同步数据
                setTimeout(() => {
                    this.showMainApp();
                    this.syncData();
                }, 1000);
            } else {
                this.showMessage('login-message', data.error || '登录失败', 'error');
            }
        } catch (error) {
            console.error('登录错误:', error);
            this.showMessage('login-message', '网络错误，请检查连接', 'error');
        }
    }
    
    async register() {
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value.trim();
        const confirmPassword = document.getElementById('confirm-password').value.trim();
        
        if (!username || !password) {
            this.showMessage('register-message', '请输入用户名和密码', 'error');
            return;
        }
        
        if (password.length < 6) {
            this.showMessage('register-message', '密码长度至少6位', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showMessage('register-message', '两次输入的密码不一致', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showMessage('register-message', '注册成功！请登录', 'success');
                
                // 清空表单
                document.getElementById('register-username').value = '';
                document.getElementById('register-password').value = '';
                document.getElementById('confirm-password').value = '';
                
                // 切换到登录标签
                setTimeout(() => {
                    this.switchAuthTab('login');
                    document.getElementById('login-username').value = username;
                }, 1500);
            } else {
                this.showMessage('register-message', data.error || '注册失败', 'error');
            }
        } catch (error) {
            console.error('注册错误:', error);
            this.showMessage('register-message', '网络错误，请检查连接', 'error');
        }
    }
    
    logout() {
        if (confirm('确定要退出登录吗？')) {
            localStorage.removeItem('overtime_user');
            localStorage.removeItem('overtime_token');
            localStorage.removeItem('overtime_data');
            
            this.currentUser = null;
            this.userToken = null;
            this.overtimeData = {};
            
            this.showAuthModal();
            this.clearCalendar();
        }
    }
    
    showMessage(elementId, message, type) {
        const element = document.getElementById(elementId);
        element.textContent = message;
        element.className = `auth-message ${type}`;
        element.style.display = 'block';
    }
    
    async syncData() {
        if (!this.userToken || this.isSyncing) return;
        
        this.isSyncing = true;
        this.updateSyncStatus('正在同步数据...', 'syncing');
        
        try {
            // 从服务器获取数据
            const response = await fetch(`${this.API_BASE_URL}/api/data`, {
                headers: {
                    'Authorization': `Bearer ${this.userToken}`
                }
            });
            
            if (response.ok) {
                const serverData = await response.json();
                
                // 合并数据（服务器数据优先）
                this.overtimeData = this.mergeData(this.overtimeData, serverData);
                
                // 保存到本地
                localStorage.setItem('overtime_data', JSON.stringify(this.overtimeData));
                
                // 上传本地数据到服务器
                await this.uploadData();
                
                this.updateSyncStatus('数据已同步', 'success');
                this.lastSyncTime = new Date();
                this.updateLastSyncTime();
                
                // 重新渲染日历
                this.renderCalendar();
            } else {
                throw new Error('同步失败');
            }
        } catch (error) {
            console.error('同步错误:', error);
            this.updateSyncStatus('同步失败，使用本地数据', 'error');
        } finally {
            this.isSyncing = false;
        }
    }
    
    async uploadData() {
        if (!this.userToken) return;
        
        try {
            await fetch(`${this.API_BASE_URL}/api/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.userToken}`
                },
                body: JSON.stringify(this.overtimeData)
            });
        } catch (error) {
            console.error('上传数据失败:', error);
        }
    }
    
    mergeData(localData, serverData) {
        // 简单的合并策略：以服务器数据为主，但保留本地有而服务器没有的数据
        const merged = { ...serverData };
        
        // 遍历本地数据，如果服务器没有该月份的数据，则添加
        for (const [month, days] of Object.entries(localData)) {
            if (!merged[month]) {
                merged[month] = days;
            }
        }
        
        return merged;
    }
    
    updateSyncStatus(message, status) {
        const element = document.getElementById('sync-status');
        element.textContent = message;
        
        // 根据状态改变颜色
        element.style.color = {
            'syncing': '#ffb347',
            'success': '#4cc9f0',
            'error': '#ef476f'
        }[status] || '#4cc9f0';
    }
    
    updateLastSyncTime() {
        const element = document.getElementById('last-sync');
        if (this.lastSyncTime) {
            const timeStr = this.lastSyncTime.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            });
            element.textContent = `上次同步: ${timeStr}`;
        } else {
            element.textContent = '';
        }
    }
    
    renderCalendar() {
        const calendarEl = document.getElementById('calendar');
        calendarEl.innerHTML = '';
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // 更新月份标题
        document.getElementById('current-month').textContent = 
            `${year}年${month + 1}月`;
        
        // 添加上一周的星期标签
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        weekdays.forEach(day => {
            const div = document.createElement('div');
            div.className = 'weekday';
            div.textContent = day;
            calendarEl.appendChild(div);
        });
        
        // 计算本月第一天是星期几
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        // 计算本月有多少天
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // 添加上个月末尾的几天
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = 0; i < firstDayOfMonth; i++) {
            const day = document.createElement('div');
            day.className = 'day other-month';
            day.textContent = prevMonthLastDay - firstDayOfMonth + i + 1;
            calendarEl.appendChild(day);
        }
        
        // 添加本月的所有天
        const monthKey = `${year}-${month + 1}`;
        const currentMonthData = this.overtimeData[monthKey] || {};
        
        for (let i = 1; i <= daysInMonth; i++) {
            const day = document.createElement('div');
            day.className = 'day';
            day.dataset.date = i;
            
            const dateNumSpan = document.createElement('span');
            dateNumSpan.className = 'date-num';
            dateNumSpan.textContent = i;
            day.appendChild(dateNumSpan);
            
            const statusSpan = document.createElement('span');
            statusSpan.className = 'status-text';
            day.appendChild(statusSpan);
            
            // 设置初始状态
            const status = currentMonthData[i] || 'normal';
            this.updateDayStatus(day, status);
            
            // 点击事件
            day.addEventListener('click', () => {
                if (day.classList.contains('other-month')) return;
                this.handleDayClick(day, i);
            });
            
            calendarEl.appendChild(day);
        }
        
        // 添加下个月开头的几天
        const totalCells = 42; // 6行 * 7列
        const cellsSoFar = firstDayOfMonth + daysInMonth;
        for (let i = 1; i <= (totalCells - cellsSoFar); i++) {
            const day = document.createElement('div');
            day.className = 'day other-month';
            day.textContent = i;
            calendarEl.appendChild(day);
        }
        
        this.updateStats();
    }
    
    handleDayClick(dayElement, dayNumber) {
        const currentStatus = dayElement.dataset.status;
        let nextStatus;
        
        switch(currentStatus) {
            case 'normal': nextStatus = 'half'; break;
            case 'half': nextStatus = 'full'; break;
            default: nextStatus = 'normal'; break;
        }
        
        this.updateDayStatus(dayElement, nextStatus);
        this.saveDayStatus(dayNumber, nextStatus);
        this.updateStats();
    }
    
    updateDayStatus(dayElement, status) {
        dayElement.classList.remove('normal', 'half', 'full');
        dayElement.classList.add(status);
        dayElement.dataset.status = status;
        
        const statusMap = { 
            'normal': '未加班', 
            'half': '半天', 
            'full': '全天' 
        };
        dayElement.querySelector('.status-text').textContent = statusMap[status];
    }
    
    saveDayStatus(day, status) {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth() + 1;
        const monthKey = `${year}-${month}`;
        
        if (!this.overtimeData[monthKey]) {
            this.overtimeData[monthKey] = {};
        }
        
        if (status === 'normal') {
            delete this.overtimeData[monthKey][day];
            // 如果这个月的数据空了，删除这个月的键
            if (Object.keys(this.overtimeData[monthKey]).length === 0) {
                delete this.overtimeData[monthKey];
            }
        } else {
            this.overtimeData[monthKey][day] = status;
        }
        
        // 保存到本地
        localStorage.setItem('overtime_data', JSON.stringify(this.overtimeData));
        
        // 异步上传到服务器
        if (this.userToken) {
            this.uploadData().catch(error => {
                console.error('保存到服务器失败:', error);
            });
        }
    }
    
    updateStats() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth() + 1;
        const monthKey = `${year}-${month}`;
        const monthData = this.overtimeData[monthKey] || {};
        
        let fullDays = 0;
        let halfDays = 0;
        
        for (const day in monthData) {
            if (monthData[day] === 'full') fullDays++;
            if (monthData[day] === 'half') halfDays++;
        }
        
        const totalDays = fullDays + (halfDays / 2);
        
        document.getElementById('count-full').textContent = fullDays;
        document.getElementById('count-half').textContent = halfDays;
        document.getElementById('count-total').textContent = totalDays.toFixed(1);
    }
    
    changeMonth(offset) {
        this.currentDate.setMonth(this.currentDate.getMonth() + offset);
        this.renderCalendar();
    }
    
    async resetCurrentMonth() {
        if (!confirm(`确定要清空 ${this.currentDate.getFullYear()}年${this.currentDate.getMonth()+1}月 的所有加班记录吗？`)) {
            return;
        }
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth() + 1;
        const monthKey = `${year}-${month}`;
        
        delete this.overtimeData[monthKey];
        localStorage.setItem('overtime_data', JSON.stringify(this.overtimeData));
        
        // 同步到服务器
        if (this.userToken) {
            await this.uploadData();
        }
        
        this.renderCalendar();
    }
    
    exportData() {
        const dataStr = JSON.stringify(this.overtimeData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `加班记录_${this.currentUser?.username || '匿名'}_${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }
    
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                this.overtimeData = this.mergeData(this.overtimeData, importedData);
                localStorage.setItem('overtime_data', JSON.stringify(this.overtimeData));
                
                if (this.userToken) {
                    this.uploadData();
                }
                
                this.renderCalendar();
                alert('数据导入成功！');
            } catch (error) {
                alert('导入失败：文件格式不正确');
            }
            event.target.value = '';
        };
        reader.readAsText(file);
    }
    
    clearCalendar() {
        this.overtimeData = {};
        this.renderCalendar();
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.overtimeTracker = new OvertimeTracker();
});