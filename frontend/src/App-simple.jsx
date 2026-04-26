import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, Volume2, Mic } from 'lucide-react';

export default function AppSimple() {
  const [wsConnected, setWsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [djMessage, setDjMessage] = useState("欢迎来到 Versior AI 电台！");
  const [currentTrack, setCurrentTrack] = useState({
    title: "加载中...", 
    artist: "AI DJ", 
    cover: "", 
    url: ""
  });
  const [inputText, setInputText] = useState("");
  const audioRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    try {
      const ws = new WebSocket('ws://localhost:8834');
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'dj_broadcast') {
            if (data.say) setDjMessage(data.say);
            if (data.track) {
              setCurrentTrack(data.track);
              if (audioRef.current && data.track.url) {
                audioRef.current.src = data.track.url;
                audioRef.current.play().catch(e => console.log("播放失败", e));
                setIsPlaying(true);
              }
            }
          }
        } catch (e) {
          console.error("消息解析错误", e);
        }
      };
      ws.onclose = () => setWsConnected(false);
    } catch (error) {
      console.warn("WebSocket 连接失败", error);
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleSkip = () => {
    if (wsRef.current && wsConnected) {
      wsRef.current.send(JSON.stringify({ type: 'command', action: 'next_track' }));
      setDjMessage("正在为您准备下一首歌曲...");
    }
  };

  const handleSendMessage = () => {
    if (!inputText.trim() || !wsConnected) return;
    wsRef.current.send(JSON.stringify({ type: 'user_input', text: inputText }));
    setInputText("");
  };

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-2xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-green-400 mb-2">🎵 Versior AI 电台</h1>
          <p className="text-gray-400">
            状态: <span className={wsConnected ? 'text-green-400' : 'text-red-400'}>
              {wsConnected ? '已连接' : '未连接'}
            </span>
          </p>
        </div>

        {/* 当前播放 */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">🎵 正在播放</h2>
          <div className="flex items-center gap-4 mb-4">
            {currentTrack.cover && (
              <img 
                src={currentTrack.cover} 
                alt="封面" 
                className="w-16 h-16 rounded-lg object-cover"
                onError={(e) => e.target.style.display = 'none'}
              />
            )}
            <div>
              <h3 className="font-bold text-lg">{currentTrack.title}</h3>
              <p className="text-gray-400">{currentTrack.artist}</p>
            </div>
          </div>
          
          <audio ref={audioRef} className="w-full mb-4" controls />
          
          <button 
            onClick={handleSkip}
            disabled={!wsConnected}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-black font-bold py-3 px-4 rounded-lg transition-colors"
          >
            ⏭️ 下一首
          </button>
        </div>

        {/* DJ 消息 */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">🤖 AI DJ 消息</h2>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-200 leading-relaxed">{djMessage}</p>
          </div>
        </div>

        {/* 用户输入 */}
        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">💬 与 DJ 对话</h2>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="对 DJ 说点什么..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500"
            />
            <button 
              onClick={handleSendMessage}
              disabled={!wsConnected || !inputText.trim()}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-black font-bold px-6 py-3 rounded-lg transition-colors"
            >
              发送
            </button>
          </div>
        </div>

        {/* 访问信息 */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>访问地址: http://192.168.0.231:7736</p>
          <p>后端服务: ws://localhost:8834</p>
        </div>
      </div>
    </div>
  );
}