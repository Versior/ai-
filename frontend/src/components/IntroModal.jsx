import React from 'react';
import { X, ExternalLink } from 'lucide-react';

export default function IntroModal({ onDismiss, onClose }) {
    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col justify-center items-center p-6 animate-in fade-in duration-300">
            <div className="bg-[#111116] border border-gray-800 rounded-2xl p-8 max-w-lg w-full text-center relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-400">
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-5xl font-pixel text-[#2ee4a6] mb-2 drop-shadow-[0_0_10px_rgba(46,228,166,0.5)]">
                    Versior
                </h2>
                <p className="text-xs text-gray-500 tracking-[0.3em] uppercase mb-6 font-pixel">
                    AI 神经元电台
                </p>

                <div className="bg-[#0a0a0c] border border-gray-800 rounded-xl p-5 text-left space-y-3 mb-6">
                    <p className="text-sm text-gray-300 leading-relaxed font-pixel">
                        欢迎来到 <span className="text-[#2ee4a6] font-bold">Versior</span>，你的专属赛博朋克 AI 音乐电台。
                    </p>
                    <div className="text-xs text-gray-400 leading-relaxed space-y-1.5 font-pixel">
                        <p>• <strong className="text-gray-300">作者：</strong>遇事开心</p>
                        <p>• <strong className="text-gray-300">主页：</strong>
                            <a
                                href="https://axoxe.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#2ee4a6] hover:underline inline-flex items-center gap-1"
                            >
                                多云禁止悲观丨KaiXin <ExternalLink className="w-3 h-3" />
                            </a>
                        </p>
                        <p>• <strong className="text-gray-300">核心：</strong>AI 模型驱动</p>
                        <p>• <strong className="text-gray-300">功能：</strong>智能音乐推荐 · 多平台歌单同步 · 天气感知</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        onClick={onDismiss}
                        className="border border-gray-600 text-gray-400 px-6 py-2.5 rounded-full hover:bg-gray-800 hover:text-white transition-all font-pixel tracking-widest text-xs uppercase"
                    >
                        今日不再展示
                    </button>
                    <button
                        onClick={onClose}
                        className="bg-[#2ee4a6] text-black px-8 py-2.5 rounded-full hover:bg-[#20b583] transition-all font-pixel tracking-widest text-xs uppercase"
                    >
                        进入电台
                    </button>
                </div>
            </div>
        </div>
    );
}
