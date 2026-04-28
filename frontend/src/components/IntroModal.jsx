import React from 'react';

export default function IntroModal({ onDismiss, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative max-w-md w-full mx-4 bg-[#111116] border border-cyan-500/30 rounded-2xl p-8 text-center">
                <button
                    onClick={onDismiss}
                    className="absolute top-3 right-3 text-gray-500 hover:text-cyan-400 transition-colors text-sm"
                >
                    不再显示
                </button>

                <div className="text-5xl mb-4">🎵</div>
                <h2 className="text-2xl font-bold text-cyan-400 mb-2" style={{ fontFamily: 'monospace' }}>
                    VERSIOR RADIO
                </h2>
                <p className="text-gray-400 mb-6 text-sm leading-relaxed">
                    AI 神经元电台已上线。<br />
                    用对话点歌，让 AI 懂你的耳朵。<br />
                    支持网易云音乐，赛博朋克界面，<br />
                    天气感知推荐。
                </p>

                <button
                    onClick={onClose}
                    className="px-8 py-3 bg-cyan-500/20 border border-cyan-500/50 rounded-lg text-cyan-400 hover:bg-cyan-500/30 transition-all font-bold tracking-wider"
                >
                    进入电台 →
                </button>
            </div>
        </div>
    );
}
