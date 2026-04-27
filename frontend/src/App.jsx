import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Square, 
  Volume2, ArrowUp, Info, Settings,
  Cloud, Sun, CloudRain, CloudSnow, Wind, Droplets,
  Music, Radio, ExternalLink, X, Loader
} from 'lucide-react';

const API_BASE = `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}`;
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}`;
const APP_VERSION = '1.0.29';

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [wsConnected, setWsConnected] = useState(false);
  const [scale, setScale] = useState(1);
  const [showIntro, setShowIntro] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentPlayTime, setCurrentPlayTime] = useState(0);
  const isDraggingRef = useRef(false); // 拖动进度条标志（用 ref 避免重渲染）
  const seekCooldownRef = useRef(false); // seek 后短暂忽略 onTimeUpdate

  const [inputText, setInputText] = useState('');
  const [systemMessage, setSystemMessage] = useState('Versior 核心系统已上线。音频矩阵正在预热。接下来需要播放什么？');
  const [currentTrack, setCurrentTrack] = useState({ title: '비행운', artist: 'MoonMoon', cover: '', url: '' });
  const [queue, setQueue] = useState([
    { title: '비행운', artist: 'MoonMoon', active: true },
    { title: "Creepin'", artist: 'Tabber, Paul Blanco, MISO', active: false },
    { title: 'Hero', artist: 'Mili', active: false },
    { title: 'Wine', artist: 'SoulChef', active: false },
    { title: '天菜(prod.by Bubbleboy)', artist: 'GAHO', active: false },
  ]);

  const [weather, setWeather] = useState(null);
  const [preloadStatus, setPreloadStatus] = useState('');
  const preloadSentRef = useRef(false);
  const preloadedTrackRef = useRef(null);
  const preloadedSayRef = useRef('');
  const preloadedQueueRef = useRef([]);

  // 设置页面
  const [settingsTab, setSettingsTab] = useState('status');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingsAuthed, setSettingsAuthed] = useState(false);
  const [settingsConfig, setSettingsConfig] = useState({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [musicLoginStatus, setMusicLoginStatus] = useState({});
  const [selectedPlatform, setSelectedPlatform] = useState('netease');
  const [loginForm, setLoginForm] = useState({ username: '', password: '', cookie: '', loginType: 'password' });
  const [backendStatus, setBackendStatus] = useState({ llm: null, music: null, checking: false });

  // 播放列表搜索状态
  const [searchingTrack, setSearchingTrack] = useState(null);

  const audioRef = useRef(null);
  const wsRef = useRef(null);

  // 刷新音乐平台登录状态
  const refreshMusicStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/music/status`);
      const data = await res.json();
      if (data.platforms) {
        const newStatus = {};
        for (const [p, info] of Object.entries(data.platforms)) {
          newStatus[p] = { loggedIn: info.loggedIn, nickname: info.nickname, trackCount: info.trackCount || 0, success: info.loggedIn };
        }
        setMusicLoginStatus(newStatus);
      }
    } catch (e) { console.warn('刷新音乐状态失败:', e.message); }
  }, []);

  // 重新获取用户数据
  const handleRefreshUserData = useCallback(async () => {
    const platform = selectedPlatform;
    if (!platform) return;
    setSettingsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/music/refresh-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform })
      });
      const data = await res.json();
      setSettingsLoading(false);
      if (data.success) {
        setMusicLoginStatus(p => ({ ...p, [platform]: { ...p[platform], success: true, nickname: data.nickname, trackCount: data.trackCount } }));
      } else {
        setSettingsError(data.error || '获取失败');
      }
    } catch (e) { setSettingsLoading(false); setSettingsError(e.message); }
  }, [selectedPlatform]);

  // === 首次弹窗 ===
  useEffect(() => {
    const dismissed = localStorage.getItem('versior_intro_dismissed');
    if (dismissed) setShowIntro(false);
    else setShowIntro(true);
    // 刷新音乐登录状态
    refreshMusicStatus();
  }, [refreshMusicStatus]);

  const handleDismissIntro = useCallback(() => {
    localStorage.setItem('versior_intro_dismissed', '1');
    setShowIntro(false);
  }, []);

  const handleCloseIntro = useCallback(() => {
    setShowIntro(false);
    userInteractedRef.current = true;
    // 如果音频已加载但没播放（WS 提前连上了），直接播放
    setTimeout(() => {
      if (audioRef.current && audioRef.current.src && audioRef.current.paused) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !audioRef.current?.src) {
        // 如果 WS 已连接但还没开始播放，主动请求第一首
        wsRef.current.send(JSON.stringify({ type: 'command', action: 'next_track' }));
        setSystemMessage('Versior 正在为你挑选第一首...');
      }
    }, 500);
  }, []);

  // === 缩放 ===
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) { setScale(1); return; }
      const s = Math.min((window.innerHeight - 120) / 920, (window.innerWidth - 120) / 672, 0.95);
      setScale(Math.max(s, 0.5));
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // === WebSocket ===
  useEffect(() => {
    let ws;
    let reconnectTimer = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT = 10;
    const connect = () => {
      try {
        ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => {
          setWsConnected(true);
          reconnectAttempts = 0;
          refreshMusicStatus();
          if (userInteractedRef.current && !audioRef.current?.src) {
            ws.send(JSON.stringify({ type: 'command', action: 'next_track' }));
            setSystemMessage('Versior 正在为你挑选第一首...');
          }
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'dj_broadcast') {
              if (data.say) setSystemMessage(data.say);
              if (data.track) doPlayTrack(data.track);
              if (data.queue) setQueue(data.queue);
              if (data.weather) { console.log('🌤️ 收到天气:', JSON.stringify(data.weather)); setWeather(data.weather); }
            } else if (data.type === 'dj_response') {
              if (data.say) setSystemMessage(data.say);
              if (data.queue) setQueue(data.queue);
              if (data.track) doPlayTrack(data.track);
              if (data.weather) { console.log('🌤️ 收到天气:', JSON.stringify(data.weather)); setWeather(data.weather); }
            } else if (data.type === 'weather_update') {
              setWeather(data.weather);
            } else if (data.type === 'preload_ready') {
              setPreloadStatus('ready');
              preloadedTrackRef.current = data.track || null;
              preloadedSayRef.current = data.say || '';
              preloadedQueueRef.current = data.queue || [];
              setTimeout(() => setPreloadStatus(''), 3000);
            }
          } catch (e) { console.error('WS parse error', e); }
        };
        ws.onclose = () => {
          setWsConnected(false);
          if (reconnectAttempts < MAX_RECONNECT) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            reconnectTimer = setTimeout(() => { reconnectAttempts++; connect(); }, delay);
          }
        };
        ws.onerror = () => { try { ws.close(); } catch(e) {} };
      } catch (e) { console.warn('WS error:', e); }
    };
    connect();
    return () => { clearTimeout(reconnectTimer); if (ws && ws.readyState === 1) ws.close(); };
  }, []);

  // === 播放核心 ===
  const userInteractedRef = useRef(false);

  const doPlayTrack = useCallback((track) => {
    setCurrentTrack(track);
    if (!audioRef.current || !track.url) return;
    // 直接用原始 CDN URL，不走代理（代理会被 CDN 防盗链拦截）
    audioRef.current.src = track.url;
    // 只有用户交互后才自动播放
    if (userInteractedRef.current) {
      const playPromise = audioRef.current.play();
      if (playPromise) {
        playPromise.then(() => setIsPlaying(true)).catch(() => {});
      }
    }
    if (wsRef.current && wsConnected && !preloadSentRef.current) {
      preloadSentRef.current = true;
      wsRef.current.send(JSON.stringify({ type: 'command', action: 'preload_next' }));
      console.log('📤 已发送 preload_next');
    }
  }, [wsConnected]);

  // === 播放列表点击：搜索→播放，不发 user_input 避免重复 ===
  const handleQueueClick = useCallback(async (track) => {
    if (track.url) { doPlayTrack(track); return; }
    setSearchingTrack(track.title);
    setSystemMessage(`正在搜索 ${track.title}...`);
    try {
      const res = await fetch(`${API_BASE}/api/search?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}`);
      const data = await res.json();
      if (data.success && data.track && data.track.url) {
        doPlayTrack(data.track);
        // 发 user_input 让 LLM 生成总结（不触发播放）
        if (wsRef.current && wsConnected) {
          wsRef.current.send(JSON.stringify({ type: 'user_input', text: `播放 ${track.title}` }));
        }
      } else {
        setSystemMessage(`抱歉，未找到 ${track.title}`);
      }
    } catch (e) {
      setSystemMessage('搜索失败，请检查网络');
    } finally {
      setSearchingTrack(null);
    }
  }, [doPlayTrack, wsConnected]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    userInteractedRef.current = true;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!audioRef.current.src && currentTrack.url) {
        doPlayTrack(currentTrack);
        return;
      }
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {
        audioRef.current.muted = true;
        audioRef.current.play().then(() => { setIsPlaying(true); setTimeout(() => { audioRef.current.muted = false; }, 100); });
      });
    }
  };

  const handleVolumeChange = (e) => {
    const v = +e.target.value;
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v / 100;
  };

  // 进度条拖动
  const handleProgressChange = (e) => {
    setProgress(parseFloat(e.target.value)); // 拖拽时只改变视觉进度
  };

  const handleSeekEnd = (e) => {
    isDraggingRef.current = false; // 鼠标松开，解除锁定
    if (audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
      const val = parseFloat(e.target.value);
      const targetTime = (val / 100) * audioRef.current.duration;
      audioRef.current.currentTime = targetTime; // 真正执行跳转
      setCurrentPlayTime(targetTime);
      if (audioRef.current.paused) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(err => console.log(err));
      }
    }
  };

  // 音频时间更新
  const onTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const dur = audioRef.current.duration;
      setCurrentPlayTime(current);
      setDuration(dur || 0);
      // 核心修复：只有在没拖拽进度条时，才允许音频更新 UI，防止冲突弹回！
      if (dur && !isDraggingRef.current) {
        setProgress((current / dur) * 100);
      }
      // 播放到 80% 后，允许新的预加载
      if (dur && current / dur > 0.8) {
        preloadSentRef.current = false;
      }
    }
  };

  const onTrackEnd = () => { setIsPlaying(false); handleSkipForward(); };

  const handleSkipForward = () => {
    // 优先使用预加载的歌曲
    if (preloadedTrackRef.current && preloadedTrackRef.current.url) {
      const t = preloadedTrackRef.current;
      preloadedTrackRef.current = null;
      setPreloadStatus('');
      setCurrentTrack(t);
      if (audioRef.current) {
        audioRef.current.src = t.url;
        if (userInteractedRef.current) {
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      }
      setSystemMessage(preloadedSayRef.current);
      setQueue(preloadedQueueRef.current);
      preloadedSayRef.current = '';
      preloadedQueueRef.current = [];
      preloadSentRef.current = false;
      if (wsRef.current && wsConnected) {
        wsRef.current.send(JSON.stringify({ type: 'command', action: 'preload_next' }));
        preloadSentRef.current = true;
      }
      return;
    }
    // 没有预加载，走原来的流程
    if (wsRef.current && wsConnected) {
      wsRef.current.send(JSON.stringify({ type: 'command', action: 'next_track' }));
      setSystemMessage('Versior 正在为你挑选下一首...');
      setIsPlaying(false);
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch(e) {}
      }
    } else {
      // WS 断开，用 HTTP 请求下一首
      setSystemMessage('正在获取下一首...');
      setIsPlaying(false);
      fetch(`${WS_URL.replace('ws://', 'http://').replace('wss://', 'https://')}/api/next`, { method: 'POST' })
        .then(r => r.json())
        .then(d => {
          if (d.track) doPlayTrack(d.track);
          if (d.say) setSystemMessage(d.say);
          if (d.queue) setQueue(d.queue);
        })
        .catch(() => setSystemMessage('网络异常，请稍后重试'));
    }
  };

  const handleSkipBack = () => {
    if (audioRef.current) audioRef.current.currentTime = 0;
    if (!isPlaying) togglePlay();
  };

  const handleStop = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setIsPlaying(false);
  };

  const handleSendMessage = () => {
    if (!inputText.trim() || !wsConnected) return;
    wsRef.current.send(JSON.stringify({ type: 'user_input', text: inputText }));
    setSystemMessage(`用户: ${inputText} ... (Versior 思考中)`);
    setInputText('');
  };

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (s) => { if (!s || isNaN(s)) return '0:00'; const m = Math.floor(s / 60), sec = Math.floor(s % 60).toString().padStart(2, '0'); return `${m}:${sec}`; };
  const fmtDate = (d) => d.toLocaleDateString('zh-CN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // === 设置页面 ===
  const checkStatus = useCallback(async () => {
    setBackendStatus(p => ({ ...p, checking: true }));
    try {
      const r = await fetch(`${API_BASE}/health`);
      const d = await r.json();
      setBackendStatus({ llm: !!d.llm, music: !!d.music, checking: false });
    } catch (e) { setBackendStatus({ llm: false, music: false, checking: false }); }
  }, []);

  const handleSettingsOpen = useCallback(async () => {
    setShowSettings(true); setSettingsTab('status'); setSettingsAuthed(false);
    setSettingsPassword(''); setSettingsError(''); setSettingsSuccess('');
    setNewPassword(''); setConfirmPassword('');
    try { const r = await fetch(`${API_BASE}/api/config`); const d = await r.json(); if (d.success) setSettingsConfig(d.config); } catch (e) {}
    checkStatus();
    refreshMusicStatus();
  }, [checkStatus, refreshMusicStatus]);

  const handleSettingsAuth = useCallback(() => {
    if (!settingsPassword.trim()) { setSettingsError('请输入密码'); return; }
    fetch(`${API_BASE}/api/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: settingsPassword }) })
      .then(r => { if (r.status === 401) { setSettingsError('密码错误'); return; } setSettingsAuthed(true); setSettingsError(''); setSettingsTab('config'); })
      .catch(e => setSettingsError('验证失败'));
  }, [settingsPassword]);

  const handleConfigSave = useCallback(() => {
    setSettingsLoading(true); setSettingsError(''); setSettingsSuccess('');
    fetch(`${API_BASE}/api/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: settingsPassword, config: settingsConfig }) })
      .then(r => r.json()).then(d => { setSettingsLoading(false); d.success ? setSettingsSuccess('配置已保存') : setSettingsError(d.error || '保存失败'); })
      .catch(e => { setSettingsLoading(false); setSettingsError('保存失败: ' + e.message); });
  }, [settingsPassword, settingsConfig]);

  const handleMusicLogin = useCallback(async () => {
    const platform = selectedPlatform;
    setSettingsLoading(true); setSettingsError('');
    setMusicLoginStatus(p => ({ ...p, [platform]: { loading: true } }));
    try {
      const body = { platform };
      if (platform === 'qqmusic' || platform === 'kugou') { body.cookie = loginForm.cookie; }
      else if (loginForm.cookie && loginForm.cookie.trim()) { body.cookie = loginForm.cookie.trim(); }
      else { body.username = loginForm.username; body.password = loginForm.password; }
      const res = await fetch(`${API_BASE}/api/music/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      setSettingsLoading(false);
      data.success
        ? setMusicLoginStatus(p => ({ ...p, [platform]: { success: true, nickname: data.nickname, trackCount: data.trackCount } }))
        : setMusicLoginStatus(p => ({ ...p, [platform]: { error: data.error || '登录失败' } }));
    } catch (e) { setSettingsLoading(false); setMusicLoginStatus(p => ({ ...p, [platform]: { error: e.message } })); }
  }, [selectedPlatform, loginForm]);

  const handleChangePassword = useCallback(async () => {
    setSettingsError(''); setSettingsSuccess('');
    if (!settingsPassword.trim()) { setSettingsError('请输入当前密码'); return; }
    if (!newPassword.trim()) { setSettingsError('请输入新密码'); return; }
    if (newPassword.length < 4) { setSettingsError('新密码至少4位'); return; }
    if (newPassword !== confirmPassword) { setSettingsError('两次输入的新密码不一致'); return; }
    setSettingsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: settingsPassword, newPassword })
      });
      const data = await res.json();
      setSettingsLoading(false);
      if (data.success) {
        setSettingsSuccess('密码修改成功！');
        setNewPassword('');
        setConfirmPassword('');
        // 如果当前验证用的密码就是旧密码，更新它
        setSettingsPassword(newPassword);
      } else {
        setSettingsError(data.error || '修改失败');
      }
    } catch (e) {
      setSettingsLoading(false);
      setSettingsError('修改失败: ' + e.message);
    }
  }, [settingsPassword, newPassword, confirmPassword]);

  const getWeatherIcon = (c) => {
    if (!c) return <Cloud className="w-4 h-4" />;
    const l = c.toLowerCase();
    if (l.includes('雨') || l.includes('rain')) return <CloudRain className="w-4 h-4" />;
    if (l.includes('雪') || l.includes('snow')) return <CloudSnow className="w-4 h-4" />;
    if (l.includes('晴') || l.includes('clear') || l.includes('sun')) return <Sun className="w-4 h-4" />;
    if (l.includes('风') || l.includes('wind')) return <Wind className="w-4 h-4" />;
    return <Cloud className="w-4 h-4" />;
  };

  const isDark = theme === 'dark';
  const bg = isDark ? 'bg-[#0a0a0c]' : 'bg-gray-200';
  const card = isDark ? 'bg-[#111116]' : 'bg-white';
  const t1 = isDark ? 'text-gray-100' : 'text-gray-900';
  const t2 = isDark ? 'text-gray-400' : 'text-gray-600';
  const brd = isDark ? 'border-gray-800/50' : 'border-gray-300';

  const Dot = ({ ok }) => <div className={`w-2 h-2 rounded-full ${ok === null ? 'bg-gray-600' : ok ? 'bg-[#2ee4a6] shadow-[0_0_6px_#2ee4a6]' : 'bg-red-500 shadow-[0_0_6px_#ef4444]'}`} />;

  return (
    <div className={`h-[100dvh] w-[100dvw] ${bg} ${t2} font-sans flex justify-center items-center overflow-hidden transition-colors duration-500`}>
      <style>{`
        :root { --halo-grad: linear-gradient(124deg, rgba(255,0,0,0.8), rgba(255,127,0,0.8), rgba(255,255,0,0.8), rgba(127,255,0,0.8), rgba(0,255,0,0.8), rgba(0,255,127,0.8), rgba(0,255,255,0.8), rgba(0,127,255,0.8), rgba(0,0,255,0.8), rgba(127,0,255,0.8), rgba(255,0,255,0.8), rgba(255,0,127,0.8), rgba(255,0,0,0.8)); }
        @keyframes halo-bg-rotation { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes halo-breathe { 0% { opacity: 0.35; transform: scale(0.98); filter: blur(30px); } 100% { opacity: 0.75; transform: scale(1.02); filter: blur(40px); } }
        .halo-container { position: relative; }
        .halo-container::before { content: ""; position: absolute; inset: -20px; background: var(--halo-grad); background-size: 600% 600%; animation: halo-bg-rotation 20s linear infinite, halo-breathe 3s ease-in-out infinite alternate; z-index: -1; border-radius: 30px; pointer-events: none; }
        .dot-matrix-bg { background-image: radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px); background-size: 12px 12px; }
        input[type="range"] { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 3px; outline: none; cursor: pointer; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #2ee4a6; cursor: grab; border: 3px solid #111116; box-shadow: 0 0 8px rgba(46,228,166,0.5); }
        input[type="range"]::-webkit-slider-thumb:active { cursor: grabbing; transform: scale(1.2); }
        input[type="range"]::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #2ee4a6; cursor: grab; border: 3px solid #111116; box-shadow: 0 0 8px rgba(46,228,166,0.5); }
      `}</style>

      <audio ref={audioRef} onTimeUpdate={onTimeUpdate} onEnded={onTrackEnd} onLoadedMetadata={() => { if (audioRef.current) { setDuration(audioRef.current.duration); } }} onError={() => { console.error('❌ 音频加载错误'); setSystemMessage('音频加载失败，尝试下一首...'); setTimeout(() => handleSkipForward(), 2000); }} preload="auto" />

      {/* ===== 弹窗 ===== */}
      {showIntro && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col justify-center items-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#111116] border border-gray-800 rounded-2xl p-8 max-w-lg w-full text-center relative">
            <button onClick={handleCloseIntro} className="absolute top-4 right-4 text-gray-600 hover:text-gray-400"><X className="w-5 h-5" /></button>
            <h2 className="text-5xl font-pixel text-[#2ee4a6] mb-2 drop-shadow-[0_0_10px_rgba(46,228,166,0.5)]">Versior</h2>
            <p className="text-xs text-gray-500 tracking-[0.3em] uppercase mb-6 font-pixel">AI 神经元电台</p>
            <div className="bg-[#0a0a0c] border border-gray-800 rounded-xl p-5 text-left space-y-3 mb-6">
              <p className="text-sm text-gray-300 leading-relaxed font-pixel">欢迎来到 <span className="text-[#2ee4a6] font-bold">Versior</span>，你的专属赛博朋克 AI 音乐电台。</p>
              <div className="text-xs text-gray-400 leading-relaxed space-y-1.5 font-pixel">
                <p>• <strong className="text-gray-300">作者：</strong>遇事开心</p>
                <p>• <strong className="text-gray-300">主页：</strong>
                  <a href="https://axoxe.com/" target="_blank" rel="noopener noreferrer" className="text-[#2ee4a6] hover:underline inline-flex items-center gap-1">
                    多云禁止悲观丨KaiXin <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
                <p>• <strong className="text-gray-300">核心：</strong>AI 模型驱动</p>
                <p>• <strong className="text-gray-300">功能：</strong>智能音乐推荐 · 多平台歌单同步 · 天气感知</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={handleDismissIntro} className="border border-gray-600 text-gray-400 px-6 py-2.5 rounded-full hover:bg-gray-800 hover:text-white transition-all font-pixel tracking-widest text-xs uppercase">今日不再展示</button>
              <button onClick={handleCloseIntro} className="bg-[#2ee4a6] text-black px-8 py-2.5 rounded-full hover:bg-[#20b583] transition-all font-pixel tracking-widest text-xs uppercase">进入电台</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 设置 ===== */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-center items-center p-4 sm:p-8 animate-in fade-in duration-300 overflow-y-auto">
          <h2 className="text-3xl sm:text-4xl text-[#2ee4a6] mb-6 sm:mb-8 drop-shadow-[0_0_10px_rgba(46,228,166,0.5)] uppercase">系统设置</h2>
          <div className="bg-[#16161b] w-full max-w-md border border-gray-800 p-4 sm:p-6 rounded-xl text-left">
            {!settingsAuthed ? (
              <div className="space-y-4">
                <p className="text-xs text-gray-400 mb-4">请输入管理员密码</p>
                <input type="password" placeholder="管理员密码" value={settingsPassword} onChange={e => setSettingsPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSettingsAuth()} className="w-full bg-[#0a0a0c] border border-gray-700 rounded-lg py-2.5 px-4 text-sm text-gray-200 focus:outline-none focus:border-[#2ee4a6]" />
                {settingsError && <p className="text-xs text-red-400">{settingsError}</p>}
                <button onClick={handleSettingsAuth} className="w-full bg-[#2ee4a6] text-black font-bold py-2.5 rounded-lg hover:bg-[#20b583] transition-colors text-sm">验证</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-1 border-b border-gray-800 pb-3">
                  {['status', 'config', 'login', 'password'].map(tab => (
                    <button key={tab} onClick={() => { setSettingsTab(tab); setSettingsError(''); setSettingsSuccess(''); }} className={`text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider transition-colors ${settingsTab === tab ? 'bg-[#2ee4a6] text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                      {tab === 'status' ? '📡 状态' : tab === 'config' ? '⚙️ 配置' : tab === 'login' ? '🎵 音乐登录' : '🔑 密码'}
                    </button>
                  ))}
                </div>

                {/* 状态 */}
                {settingsTab === 'status' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-gray-800/50 pb-3">
                      <div><h3 className="text-[13px] text-gray-200 tracking-wider">WebSocket</h3><p className="text-[10px] text-gray-500 mt-1 font-mono">{WS_URL}</p></div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] tracking-widest uppercase ${wsConnected ? 'text-[#2ee4a6]' : 'text-red-500 animate-pulse'}`}>{wsConnected ? '已连接' : '已断开'}</span>
                        <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-[#2ee4a6] shadow-[0_0_8px_#2ee4a6]' : 'bg-red-500'}`} />
                      </div>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-800/50 pb-3">
                      <div><h3 className="text-[13px] text-gray-200 tracking-wider">AI 模型</h3><p className="text-[10px] text-gray-500 mt-1 font-mono">{settingsConfig.LONGCAT_MODEL || '未配置'}</p></div>
                      <div className="flex items-center gap-2"><Dot ok={backendStatus.llm} /><span className="text-[10px] text-gray-500">{backendStatus.llm ? '正常' : '异常'}</span></div>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-800/50 pb-3">
                      <div><h3 className="text-[13px] text-gray-200 tracking-wider">音乐 API</h3><p className="text-[10px] text-gray-500 mt-1 font-mono">{settingsConfig.MUSIC_API_URL || 'iwenwiki.com:3000'}</p></div>
                      <div className="flex items-center gap-2"><Dot ok={backendStatus.music} /><span className="text-[10px] text-gray-500">{backendStatus.music ? '正常' : '异常'}</span></div>
                    </div>
                    {weather && (
                      <div className="flex justify-between items-center pt-1">
                        <div><h3 className="text-[13px] text-gray-200 tracking-wider">天气</h3><p className="text-[10px] text-gray-500 mt-1">{weather.city} {weather.condition} {weather.temp}</p><p className="text-[10px] text-gray-500">体感 {weather.feelsLike} · {weather.humidity} · {weather.wind}</p></div>
                        {getWeatherIcon(weather.condition)}
                      </div>
                    )}
                    <button onClick={checkStatus} disabled={backendStatus.checking} className="w-full mt-2 border border-gray-700 text-gray-400 py-2 rounded-lg hover:bg-gray-800 hover:text-white transition-colors text-xs disabled:opacity-50 font-bold">
                      {backendStatus.checking ? '检测中...' : '重新检测'}
                    </button>
                  </div>
                )}

                {/* 配置 */}
                {settingsTab === 'config' && (
                  <div className="space-y-3">
                    <div><label className="text-[10px] text-gray-400 uppercase tracking-wider">API URL</label><input value={settingsConfig.LONGCAT_API_URL || ''} onChange={e => setSettingsConfig(p => ({ ...p, LONGCAT_API_URL: e.target.value }))} className="w-full bg-[#0a0a0c] border border-gray-700 rounded-lg py-2 px-3 text-xs text-gray-200 mt-1 focus:outline-none focus:border-[#2ee4a6] font-mono" /></div>
                    <div><label className="text-[10px] text-gray-400 uppercase tracking-wider">API Key</label><input value={settingsConfig.LONGCAT_API_KEY || ''} onChange={e => setSettingsConfig(p => ({ ...p, LONGCAT_API_KEY: e.target.value }))} className="w-full bg-[#0a0a0c] border border-gray-700 rounded-lg py-2 px-3 text-xs text-gray-200 mt-1 focus:outline-none focus:border-[#2ee4a6] font-mono" /></div>
                    <div><label className="text-[10px] text-gray-400 uppercase tracking-wider">模型</label><input value={settingsConfig.LONGCAT_MODEL || ''} onChange={e => setSettingsConfig(p => ({ ...p, LONGCAT_MODEL: e.target.value }))} className="w-full bg-[#0a0a0c] border border-gray-700 rounded-lg py-2 px-3 text-xs text-gray-200 mt-1 focus:outline-none focus:border-[#2ee4a6] font-mono" /></div>
                    <div><label className="text-[10px] text-gray-400 uppercase tracking-wider">音乐 API URL</label><input value={settingsConfig.MUSIC_API_URL || ''} onChange={e => setSettingsConfig(p => ({ ...p, MUSIC_API_URL: e.target.value }))} className="w-full bg-[#0a0a0c] border border-gray-700 rounded-lg py-2 px-3 text-xs text-gray-200 mt-1 focus:outline-none focus:border-[#2ee4a6] font-mono" /></div>
                    <div><label className="text-[10px] text-gray-400 uppercase tracking-wider">音乐源</label>
                      <select value={settingsConfig.MUSIC_SOURCE || 'netease'} onChange={e => setSettingsConfig(p => ({ ...p, MUSIC_SOURCE: e.target.value }))} className="w-full bg-[#0a0a0c] border border-gray-700 rounded-lg py-2 px-3 text-xs text-gray-200 mt-1 focus:outline-none focus:border-[#2ee4a6] font-mono">
                        <option value="netease">网易云</option><option value="kuwo">酷我</option><option value="qqmusic">QQ音乐</option><option value="kugou">酷狗</option>
                      </select>
                    </div>
                    {settingsError && <p className="text-xs text-red-400">{settingsError}</p>}
                    {settingsSuccess && <p className="text-xs text-[#2ee4a6]">{settingsSuccess}</p>}
                    <button onClick={handleConfigSave} disabled={settingsLoading} className="w-full bg-[#2ee4a6] text-black font-bold py-2.5 rounded-lg hover:bg-[#20b583] transition-colors text-sm disabled:opacity-50">{settingsLoading ? '保存中...' : '保存配置'}</button>
                  </div>
                )}

                {/* 登录 */}
                {settingsTab === 'login' && (
                  <div className="space-y-3">
                    {/* 当前登录状态 */}
                    <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                      <h4 className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">当前登录状态</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {[{ k: 'netease', l: '网易云' }, { k: 'kuwo', l: '酷我' }, { k: 'qqmusic', l: 'QQ音乐' }, { k: 'kugou', l: '酷狗' }].map(p => (
                          <div key={p.k} className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${musicLoginStatus[p.k]?.success ? 'bg-[#2ee4a6]' : 'bg-gray-600'}`} />
                            <span className="text-[9px] text-gray-400">{p.l}</span>
                            {musicLoginStatus[p.k]?.success && <span className="text-[8px] text-[#2ee4a6]">✓</span>}
                          </div>
                        ))}
                      </div>
                      <button onClick={refreshMusicStatus} className="text-[9px] text-gray-500 hover:text-[#2ee4a6] underline">刷新状态</button>
                    </div>

                    {/* 推荐歌曲 */}
                    {Object.values(musicLoginStatus).some(s => s?.success) && (
                      <div className="bg-[#2ee4a6]/5 border border-[#2ee4a6]/20 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] text-[#2ee4a6] uppercase tracking-wider font-bold">🎵 基于你的偏好推荐</h4>
                          <span className="text-[9px] text-gray-500">{Object.values(musicLoginStatus).reduce((sum, s) => sum + (s?.trackCount || 0), 0)} 首歌曲</span>
                        </div>
                        <p className="text-[9px] text-gray-400 leading-relaxed">已登录 {Object.entries(musicLoginStatus).filter(([_, s]) => s?.success).map(([p, s]) => s.nickname || p).join('、')}，AI 会从你的歌单中挑选推荐曲目。</p>
                        <button onClick={() => { if (wsRef.current && wsConnected) { wsRef.current.send(JSON.stringify({ type: 'user_input', text: '根据我的歌单推荐一首歌' })); } }} className="w-full text-[10px] font-bold py-1.5 rounded-lg bg-[#2ee4a6]/10 text-[#2ee4a6] hover:bg-[#2ee4a6]/20 transition-colors">🎲 换一批推荐</button>
                      </div>
                    )}

                    {/* 选择平台登录 */}
                    <div className="flex gap-1 mb-2 flex-wrap">
                      {[{ k: 'netease', l: '网易云' }, { k: 'kuwo', l: '酷我' }, { k: 'qqmusic', l: 'QQ音乐' }, { k: 'kugou', l: '酷狗' }].map(p => (
                        <button key={p.k} onClick={() => { setSelectedPlatform(p.k); setLoginForm({ username: '', password: '', cookie: '', loginType: 'password' }); setMusicLoginStatus(prev => { const n = { ...prev }; delete n[p.k]; return n; }); }} className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${selectedPlatform === p.k ? 'bg-[#2ee4a6] text-black' : 'bg-gray-800 text-gray-400'}`}>{p.l}</button>
                      ))}
                    </div>
                    {(selectedPlatform === 'qqmusic' || selectedPlatform === 'kugou') ? (
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider">Cookie</label>
                        <textarea value={loginForm.cookie} onChange={e => setLoginForm(p => ({ ...p, cookie: e.target.value }))} placeholder="从浏览器复制 Cookie..." rows={3} className="w-full bg-[#0a0a0c] border border-gray-700 rounded-lg py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-[#2ee4a6] font-mono resize-none" />
                        <button onClick={() => window.open(selectedPlatform === 'qqmusic' ? 'https://y.qq.com' : 'https://www.kugou.com', '_blank')} className="text-[10px] text-gray-500 hover:text-[#2ee4a6] underline">打开 {selectedPlatform === 'qqmusic' ? 'QQ音乐' : '酷狗'} 获取 Cookie</button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-2 mb-1">
                          <button onClick={() => setLoginForm(p => ({ ...p, loginType: 'password' }))} className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${(loginForm.loginType || 'password') === 'password' ? 'bg-[#2ee4a6] text-black' : 'bg-gray-800 text-gray-400'}`}>账号密码</button>
                          <button onClick={() => setLoginForm(p => ({ ...p, loginType: 'cookie' }))} className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${loginForm.loginType === 'cookie' ? 'bg-[#2ee4a6] text-black' : 'bg-gray-800 text-gray-400'}`}>Cookie</button>
                        </div>
                        {(loginForm.loginType || 'password') === 'password' ? (
                          <>
                            <input value={loginForm.username} onChange={e => setLoginForm(p => ({ ...p, username: e.target.value }))} placeholder="账号 / 手机号" className="w-full bg-[#0a0a0c] border border-gray-700 rounded-lg py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-[#2ee4a6]" />
                            <input type="password" value={loginForm.password} onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))} placeholder="密码" className="w-full bg-[#0a0a0c] border border-gray-700 rounded-lg py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-[#2ee4a6]" />
                          </>
                        ) : (
                          <>
                            <textarea value={loginForm.cookie} onChange={e => setLoginForm(p => ({ ...p, cookie: e.target.value }))} placeholder="从浏览器复制 Cookie..." rows={3} className="w-full bg-[#0a0a0c] border border-gray-700 rounded-lg py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-[#2ee4a6] font-mono resize-none" />
                            <button onClick={() => window.open(selectedPlatform === 'netease' ? 'https://music.163.com' : 'https://www.kuwo.cn', '_blank')} className="text-[10px] text-gray-500 hover:text-[#2ee4a6] underline">打开 {selectedPlatform === 'netease' ? '网易云' : '酷我'} 获取 Cookie</button>
                          </>
                        )}
                      </div>
                    )}
                    {musicLoginStatus[selectedPlatform]?.success && (
                      <div className="text-xs text-[#2ee4a6]">
                        ✓ 已登录 {musicLoginStatus[selectedPlatform].nickname || ''}，获取了 {musicLoginStatus[selectedPlatform].trackCount || 0} 首歌曲
                      </div>
                    )}
                    {musicLoginStatus[selectedPlatform]?.error && (
                      <div className="text-xs text-red-400">
                        ✗ {musicLoginStatus[selectedPlatform].error}
                      </div>
                    )}
                    <button onClick={handleMusicLogin} disabled={settingsLoading} className="w-full bg-[#2ee4a6] text-black font-bold py-2.5 rounded-lg hover:bg-[#20b583] transition-colors text-sm disabled:opacity-50">{settingsLoading ? '登录中...' : '登录并获取歌单'}</button>
                    {musicLoginStatus[selectedPlatform]?.success && (
                      <button onClick={handleRefreshUserData} disabled={settingsLoading} className="w-full border border-gray-600 text-gray-400 font-bold py-2 rounded-lg hover:bg-gray-800 hover:text-white transition-colors text-xs disabled:opacity-50">
                        🔄 重新获取用户数据
                      </button>
                    )}
                  </div>
                )}

                {/* 修改密码 */}
                {settingsTab === 'password' && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">修改管理员密码</p>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider">当前密码</label>
                      <input type="password" value={settingsPassword} onChange={e => setSettingsPassword(e.target.value)} placeholder="输入当前密码" className="w-full bg-[#0a0a0c] border border-gray-700 rounded-lg py-2 px-3 text-xs text-gray-200 mt-1 focus:outline-none focus:border-[#2ee4a6]" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider">新密码</label>
                      <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="输入新密码（至少4位）" className="w-full bg-[#0a0a0c] border border-gray-700 rounded-lg py-2 px-3 text-xs text-gray-200 mt-1 focus:outline-none focus:border-[#2ee4a6]" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider">确认新密码</label>
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="再次输入新密码" className="w-full bg-[#0a0a0c] border border-gray-700 rounded-lg py-2 px-3 text-xs text-gray-200 mt-1 focus:outline-none focus:border-[#2ee4a6]" />
                    </div>
                    {settingsError && <p className="text-xs text-red-400">{settingsError}</p>}
                    {settingsSuccess && <p className="text-xs text-[#2ee4a6]">{settingsSuccess}</p>}
                    <button onClick={handleChangePassword} disabled={settingsLoading} className="w-full bg-[#2ee4a6] text-black font-bold py-2.5 rounded-lg hover:bg-[#20b583] transition-colors text-sm disabled:opacity-50">
                      {settingsLoading ? '修改中...' : '确认修改密码'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <button onClick={() => setShowSettings(false)} className="mt-6 sm:mt-10 border border-gray-600 text-gray-400 px-8 py-2.5 rounded-full hover:bg-gray-800 hover:text-white transition-all font-bold tracking-widest text-xs uppercase">关闭</button>
        </div>
      )}

      {/* ===== 主界面 ===== */}
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center' }} className="flex justify-center items-center">
        <div className={`${isDark ? 'halo-container' : 'shadow-2xl'} w-[672px] relative transition-all duration-500`}>
          <div className={`w-full ${card} rounded-[16px] overflow-hidden flex flex-col relative border ${brd} shadow-2xl z-10`}>

            {/* 顶部 */}
            <div className="px-6 py-5 flex justify-between items-center">
              <h1 className={`text-4xl tracking-[0.15em] font-pixel ${t1} uppercase`} style={{ textShadow: isDark ? '0 0 15px rgba(255,255,255,0.2)' : 'none' }}>Versior</h1>
              <div className="flex items-center gap-2 sm:gap-3">
                <button onClick={() => setShowIntro(true)} className="text-[10px] tracking-widest text-gray-400 hover:text-white transition-colors uppercase border border-gray-800 rounded-full px-3 py-1.5 flex items-center gap-1"><Info className="w-3 h-3" /> 关于</button>
                <button onClick={handleSettingsOpen} className="text-[10px] tracking-widest text-gray-400 hover:text-white transition-colors uppercase border border-gray-800 rounded-full px-3 py-1.5 flex items-center gap-1"><Settings className="w-3 h-3" /> 设置</button>
                <div className={`hidden sm:flex ${isDark ? 'bg-[#0a0a0c]' : 'bg-gray-100'} rounded-full p-1 border ${brd} ml-2`}>
                  <button onClick={() => setTheme('dark')} className={`${isDark ? 'bg-white text-black shadow-md' : 'text-gray-500 hover:text-black'} text-[10px] font-bold px-3 py-1 rounded-full uppercase transition-all tracking-wider`}>暗色</button>
                  <button onClick={() => setTheme('light')} className={`${!isDark ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-white'} text-[10px] font-bold px-3 py-1 rounded-full uppercase transition-all tracking-wider`}>亮色</button>
                </div>
              </div>
            </div>

            {/* 时钟 */}
            <div className={`relative h-48 border-y ${brd} ${isDark ? 'bg-[#0d0d12] dot-matrix-bg' : 'bg-gray-50'} flex flex-col justify-center items-center overflow-hidden`}>
              <div className={`text-7xl sm:text-[100px] tracking-[0.1em] font-pixel ${t1} mb-2 leading-none`} style={{ textShadow: isDark ? '0 0 20px rgba(255,255,255,0.15)' : 'none' }}>
                {currentTime.getHours().toString().padStart(2, '0')}<span className="mx-2 opacity-50 animate-[pulse_1s_ease-in-out_infinite]">:</span>{currentTime.getMinutes().toString().padStart(2, '0')}
              </div>
              <div className="text-[10px] text-gray-500 tracking-[0.2em] uppercase font-medium mt-2">{fmtDate(currentTime)}</div>
              <div className="mt-4 flex items-center gap-3 text-[10px] font-bold tracking-[0.2em] uppercase">
                <span className="flex items-center gap-2 text-[#2ee4a6]">
                  <span className={`w-2 h-2 rounded-full bg-[#2ee4a6] ${wsConnected ? 'animate-pulse shadow-[0_0_10px_#2ee4a6]' : 'opacity-30'}`} />{wsConnected ? '信号已连接' : '信号丢失'}
                </span>
                {Object.values(musicLoginStatus).some(s => s?.success) && (
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Music className="w-3 h-3 text-[#2ee4a6]/60" />
                    <span>{Object.entries(musicLoginStatus).filter(([_, s]) => s?.success).map(([_, s]) => s.nickname).join(', ')}</span>
                    <span className="text-gray-600">·</span>
                    <span>{Object.values(musicLoginStatus).reduce((sum, s) => sum + (s?.trackCount || 0), 0)}</span>
                  </span>
                )}
              </div>
            </div>

            {/* 天气 */}
            {weather && (
              <div className={`px-6 py-3 ${isDark ? 'bg-[#0f0f13]' : 'bg-gray-50'} border-b ${brd}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2ee4a6]/10 flex items-center justify-center">{getWeatherIcon(weather.condition)}</div>
                    <div><p className={`text-xs font-bold ${t1}`}>{weather.city} {weather.condition} {weather.temp}</p><p className="text-[10px] text-gray-500">体感 {weather.feelsLike} · {weather.humidity} · {weather.wind}</p></div>
                  </div>
                </div>
              </div>
            )}

            {/* 播放控制 */}
            <div className={`px-6 py-5 ${isDark ? 'bg-[#141419]' : 'bg-gray-100'}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
                <div className="flex items-center gap-4">
                  <div className={`flex items-end h-6 gap-[3px] ${isPlaying ? 'opacity-100' : 'opacity-40'} transition-opacity`}>
                    {[3, 6, 4, 5].map((h, i) => <div key={i} className={`w-1.5 h-${h} bg-[#2ee4a6] ${isPlaying ? `animate-[bounce_1s_infinite_${i * 100}ms]` : ''} origin-bottom rounded-t-sm`} />)}
                  </div>
                  <div>
                    <h2 className={`text-sm font-bold ${t1} line-clamp-1`}>{currentTrack.title} - {currentTrack.artist}</h2>
                    <p className="text-[10px] tracking-[0.2em] text-gray-500 uppercase mt-1">
                      {searchingTrack ? <span className="flex items-center gap-1"><Loader className="w-3 h-3 animate-spin" /> 搜索中...</span> : '正在播放'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={handleSkipBack} className={`w-8 h-8 rounded-full border ${brd} flex justify-center items-center hover:text-[#2ee4a6] hover:border-[#2ee4a6] transition-all`}><SkipBack className="w-3.5 h-3.5 fill-current" /></button>
                  <button onClick={togglePlay} className={`w-10 h-10 rounded-full border-2 ${brd} flex justify-center items-center hover:text-[#2ee4a6] hover:border-[#2ee4a6] transition-all`}>
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                  </button>
                  <button onClick={handleSkipForward} className={`w-8 h-8 rounded-full border ${brd} flex justify-center items-center hover:text-[#2ee4a6] hover:border-[#2ee4a6] transition-all`}><SkipForward className="w-3.5 h-3.5 fill-current" /></button>
                  <button onClick={handleStop} className={`w-8 h-8 rounded-full border ${brd} flex justify-center items-center hover:text-[#2ee4a6] hover:border-[#2ee4a6] transition-all`}><Square className="w-3.5 h-3.5 fill-current" /></button>
                  <div className="flex items-center gap-2 ml-2">
                    <Volume2 className="w-3.5 h-3.5 text-gray-500" />
                    <input type="range" min="0" max="100" value={volume} onChange={handleVolumeChange} className="w-16" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-mono text-gray-500 w-10 text-right">{fmt(currentPlayTime)}</span>
                <input
                  type="range" min="0" max="100" step="0.1" value={progress || 0}
                  onMouseDown={() => { isDraggingRef.current = true; }}
                  onTouchStart={() => { isDraggingRef.current = true; }}
                  onChange={handleProgressChange}
                  onMouseUp={handleSeekEnd}
                  onTouchEnd={handleSeekEnd}
                  className="w-full h-1 bg-gray-800 rounded-full appearance-none cursor-pointer hover:h-1.5 transition-all"
                  style={{ background: `linear-gradient(to right, #2ee4a6 ${progress}%, ${isDark ? '#1f2937' : '#e5e7eb'} ${progress}%)` }}
                />
                <span className="text-[10px] font-mono text-gray-500 w-10">{fmt(duration || 0)}</span>
              </div>
            </div>

            {/* 播放列表 */}
            <div className={`${isDark ? 'bg-[#0f0f13]' : 'bg-gray-50'} border-t ${brd}`}>
              <div className={`flex justify-between px-6 py-2.5 text-[10px] tracking-widest border-b ${brd} text-gray-500`}>
                <span>播放列表</span>
                <span>{queue.length} 首曲目 {preloadStatus === 'ready' ? '· ✓ 已就绪' : ''}</span>
              </div>
              <div className="flex flex-col">
                {queue.map((track, idx) => {
                  const isActive = currentTrack.title === track.title || track.active;
                  const isSearching = searchingTrack === track.title;
                  return (
                    <div key={idx} onClick={() => !isSearching && handleQueueClick(track)} className={`flex items-center justify-between px-6 py-2.5 text-xs border-l-[3px] ${isActive ? 'border-[#2ee4a6] bg-[#2ee4a6]/5' : 'border-transparent hover:bg-gray-800/30'} ${isSearching ? 'opacity-50' : 'cursor-pointer'} transition-colors`}>
                      <div className="flex items-center gap-4">
                        {isActive ? <Play className="w-3 h-3 text-[#2ee4a6] fill-current" /> : <span className="text-gray-600 font-mono w-3 text-right">{idx + 1}</span>}
                        <span className={isActive ? 'text-gray-200 font-medium' : 'text-gray-400'}>{track.title}</span>
                      </div>
                      <span className={`text-[10px] ${isActive ? 'text-[#2ee4a6]/80' : 'text-gray-600'}`}>{isSearching ? '搜索中...' : track.artist}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 热评区域 */}
            {currentTrack.hotComment && (
              <div className={`px-6 py-4 ${isDark ? 'bg-[#0d0d10]' : 'bg-gray-50'} border-t ${brd}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-gray-500 tracking-widest uppercase">💬 热评</span>
                </div>
                <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'} leading-relaxed`}>{currentTrack.hotComment}</p>
              </div>
            )}

            {/* AI 交互 */}
            <div className={`p-6 ${isDark ? 'bg-[#111116]' : 'bg-white'} border-t ${brd}`}>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-[#2ee4a6]"></span>
                <span className="text-xs font-pixel tracking-widest uppercase text-gray-300">Versior</span>
              </div>
              <div className="flex gap-4">
                <div className={`w-10 h-10 rounded-full border ${brd} overflow-hidden shrink-0`}>
                  <img src="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=200&auto=format&fit=crop" alt="Versior" className="w-full h-full object-cover" />
                </div>
                <div className={`flex-1 ${isDark ? 'bg-[#1a1a21]' : 'bg-gray-100'} rounded-2xl rounded-tl-none p-4 border ${brd}`}>
                  <p className={`text-[13px] ${t1} leading-relaxed font-sans`}>{systemMessage}</p>
                </div>
              </div>
              <div className="mt-6 relative flex items-center">
                <input type="text" placeholder="输入指令..." value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} className={`w-full ${isDark ? 'bg-[#16161b] text-gray-200' : 'bg-gray-100 text-gray-900'} border ${brd} rounded-xl py-3 pl-4 pr-14 text-sm focus:outline-none focus:border-[#2ee4a6] transition-colors`} />
                <button onClick={handleSendMessage} disabled={!wsConnected} className={`absolute right-2 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${wsConnected ? 'bg-[#2ee4a6] text-black hover:bg-[#20b583]' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}>
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 底部 */}
            <div className={`px-6 py-4 flex justify-between text-[10px] tracking-[0.2em] text-gray-600 font-mono uppercase ${isDark ? 'bg-[#0d0d12]' : 'bg-gray-100'} border-t ${brd}`}>
              <span>Versior FM <span className="text-gray-700">v{APP_VERSION}</span></span>
              <span className={wsConnected ? 'text-[#2ee4a6]' : 'text-gray-600'}>{wsConnected ? '已连接' : '已断开'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
