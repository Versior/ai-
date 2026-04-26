const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

class WeatherService {
    constructor() {
        this.cache = null;
        this.cacheTime = 0;
        this.cacheTtl = 10 * 60 * 1000; // 10分钟缓存
        this.windKey = process.env.WIND_KEY || process.env.OPENWEATHER_KEY || '';
    }

    /**
     * 城市英文名转中文
     */
    cityNameZh(en) {
        const map = {
            'Shanghai': '上海', 'Beijing': '北京', 'Guangzhou': '广州',
            'Shenzhen': '深圳', 'Hangzhou': '杭州', 'Chengdu': '成都',
            'Nanjing': '南京', 'Wuhan': '武汉', "Xi'an": '西安',
            'Suzhou': '苏州', 'Tianjin': '天津', 'Chongqing': '重庆',
            'Dalian': '大连', 'Qingdao': '青岛', 'Xiamen': '厦门',
            'Kunming': '昆明', 'Changsha': '长沙', 'Fuzhou': '福州',
            'Hefei': '合肥', 'Nanchang': '南昌', 'Nanning': '南宁',
            'Zhengzhou': '郑州', 'Changchun': '长春', 'Harbin': '哈尔滨',
            'Shijiazhuang': '石家庄', 'Taiyuan': '太原', 'Guiyang': '贵阳',
            'Lanzhou': '兰州', 'Haikou': '海口', 'Urumqi': '乌鲁木齐',
            'Lhasa': '拉萨', 'Yinchuan': '银川', 'Hohhot': '呼和浩特',
            'Shenyang': '沈阳', 'Jinan': '济南', 'Wuxi': '无锡',
            'Nantong': '南通', 'Changzhou': '常州', 'Xuzhou': '徐州',
            'Wenzhou': '温州', 'Ningbo': '宁波', 'Jiaxing': '嘉兴',
            'Shaoxing': '绍兴', 'Taizhou': '台州', 'Jinhua': '金华',
            'Zhoushan': '舟山', 'Huzhou': '湖州', 'Quzhou': '衢州',
            'Lishui': '丽水', 'Foshan': '佛山', 'Dongguan': '东莞',
            'Zhongshan': '中山', 'Zhuhai': '珠海', 'Huizhou': '惠州',
            'Jiangmen': '江门', 'Zhaoqing': '肇庆', 'Shantou': '汕头',
            'Zhanjiang': '湛江', 'Maoming': '茂名', 'Meizhou': '梅州',
            'Shaoguan': '韶关', 'Chaozhou': '潮州', 'Jieyang': '揭阳',
            'Yunfu': '云浮', 'Yangjiang': '阳江', 'Heyuan': '河源',
            'Qingyuan': '清远', 'Shanwei': '汕尾'
        };
        return map[en] || en;
    }

    /**
     * 天气英文描述转中文
     */
    weatherDescZh(desc) {
        if (!desc) return '未知';
        const map = {
            'sunny': '晴', 'clear': '晴', 'clear sky': '晴',
            'partly cloudy': '多云', 'cloudy': '多云', 'overcast': '阴',
            'overcast clouds': '阴', 'scattered clouds': '多云',
            'few clouds': '少云', 'broken clouds': '阴天',
            'light rain': '小雨', 'rain': '雨', 'moderate rain': '中雨',
            'heavy rain': '大雨', 'shower rain': '阵雨', 'thunderstorm': '雷雨',
            'snow': '雪', 'light snow': '小雪', 'heavy snow': '大雪',
            'sleet': '雨夹雪', 'mist': '薄雾', 'fog': '雾', 'haze': '霾',
            'drizzle': '毛毛雨', 'light drizzle': '细雨'
        };
        const lower = desc.toLowerCase();
        for (const [en, zh] of Object.entries(map)) {
            if (lower.includes(en)) return zh;
        }
        return desc; // 已经是中文就原样返回
    }

    /**
     * 获取客户端 IP 对应的城市
     * 内网 IP 时通过公网 IP 查询
     */
    async getCityFromIP(ip) {
        // 内网 IP，先获取公网 IP
        if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('127.') 
            || ip.startsWith('::ffff:192.168.') || ip.startsWith('::ffff:10.')
            || ip.startsWith('::1') || ip === '::ffff:127.0.0.1') {
            // 多接口尝试获取公网 IP
            const ipApis = [
                'https://httpbin.org/ip',
                'https://api.ipify.org?format=json',
                'https://api.my-ip.io/ip.json',
            ];
            for (const api of ipApis) {
                try {
                    const res = await axios.get(api, { timeout: 5000 });
                    const ip = res.data?.origin || res.data?.ip;
                    if (ip) {
                        console.log(`🌐 公网 IP: ${ip}`);
                        return await this.getCityFromPublicIP(ip);
                    }
                } catch (e) { /* 继续下一个 */ }
            }
            console.warn('⚠️ 获取公网 IP 失败');
            return '上海';
        }
        return await this.getCityFromPublicIP(ip);
    }

    async getCityFromPublicIP(ip) {
        try {
            const res = await axios.get(`http://ip-api.com/json/${ip}?fields=status,city,countryCode,query&lang=zh-CN`, {
                timeout: 5000
            });
            if (res.data && res.data.status === 'success') {
                const city = res.data.city || '上海';
                console.log(`📍 IP定位: ${ip} → ${city}`);
                return city;
            }
        } catch (e) {
            console.warn('⚠️ IP 定位失败:', e.message);
        }
        return '上海';
    }

    /**
     * 获取天气 - 主入口
     */
    async getWeather(clientIP) {
        const now = Date.now();
        if (this.cache && (now - this.cacheTime) < this.cacheTtl) {
            return this.cache;
        }

        const cityEn = await this.getCityFromIP(clientIP || '127.0.0.1');
        const cityZh = this.cityNameZh(cityEn);
        
        // 方案1: wttr.in (免费，优先)
        const w = await this.getFromWttr(cityEn);
        if (w) {
            w.city = cityZh;
            w.condition = this.weatherDescZh(w.condition);
            if (!w.conditionZh) w.conditionZh = w.condition;
            return w;
        }

        // 方案2: OpenWeatherMap (需要 key)
        if (this.windKey) {
            const w2 = await this.getFromOpenWeather(cityEn);
            if (w2) {
                w2.city = cityZh;
                w2.condition = this.weatherDescZh(w2.condition);
                return w2;
            }
        }

        // 方案3: Open-Meteo (免费)
        const w3 = await this.getFromOpenMeteo(cityEn);
        if (w3) {
            w3.city = cityZh;
            return w3;
        }

        console.warn('⚠️ 所有天气 API 均不可用');
        return null;
    }

    async getFromWttr(city) {
        try {
            const res = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, {
                timeout: 8000,
                headers: { 'User-Agent': 'curl/7.68.0' }
            });
            const cur = res.data?.current_condition?.[0];
            if (!cur) return null;

            // 优先用 wttr.in 的中文描述，没有再翻译
            const weatherDesc = cur.lang_zh?.[0]?.value || this.weatherDescZh(cur.weatherDesc?.[0]?.value || '');
            
            // 风向转中文
            const windDirMap = {
                'N': '北风', 'NNE': '北东北风', 'NE': '东北风', 'ENE': '东东北风',
                'E': '东风', 'ESE': '东东南风', 'SE': '东南风', 'SSE': '南东南风',
                'S': '南风', 'SSW': '南西南风', 'SW': '西南风', 'WSW': '西西南风',
                'W': '西风', 'WNW': '西西北风', 'NW': '西北风', 'NNW': '北西北风'
            };
            const windDir = windDirMap[cur.winddir16Point] || cur.winddir16Point || '';

            this.cache = {
                city: city,
                condition: weatherDesc,
                temp: `${cur.temp_C}°C`,
                feelsLike: `${cur.FeelsLikeC}°C`,
                humidity: `${cur.humidity}%`,
                wind: windDir ? `${windDir} ${cur.windspeedKmph}km/h` : `${cur.windspeedKmph}km/h`,
                icon: cur.weatherIconUrl?.[0]?.value || '',
                raw: `${weatherDesc} ${cur.temp_C}°C`
            };
            this.cacheTime = Date.now();
            console.log(`🌤️ 天气(wttr.in): ${this.cache.raw}`);
            return this.cache;
        } catch (e) {
            return null;
        }
    }

    async getFromOpenWeather(city) {
        try {
            const res = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
                params: { q: city, appid: this.windKey, lang: 'zh_cn', units: 'metric' },
                timeout: 8000
            });
            const d = res.data;
            if (!d || !d.main) return null;

            this.cache = {
                city: city,
                condition: d.weather?.[0]?.description || '',
                temp: `${Math.round(d.main.temp)}°C`,
                feelsLike: `${Math.round(d.main.feels_like)}°C`,
                humidity: `${d.main.humidity}%`,
                wind: `${d.wind?.speed || 0}m/s`,
                icon: d.weather?.[0]?.icon ? `https://openweathermap.org/img/wn/${d.weather[0].icon}@2x.png` : '',
                raw: `${d.weather?.[0]?.description || ''} ${Math.round(d.main.temp)}°C`
            };
            this.cacheTime = Date.now();
            console.log(`🌤️ 天气(openweather): ${this.cache.raw}`);
            return this.cache;
        } catch (e) {
            return null;
        }
    }

    async getFromOpenMeteo(city) {
        try {
            const coords = {
                'Shanghai': { lat: 31.23, lon: 121.47 }, 'Beijing': { lat: 39.90, lon: 116.40 },
                'Guangzhou': { lat: 23.13, lon: 113.26 }, 'Shenzhen': { lat: 22.54, lon: 114.05 },
                'Hangzhou': { lat: 30.27, lon: 120.15 }, 'Chengdu': { lat: 30.57, lon: 104.07 },
                'Nanjing': { lat: 32.06, lon: 118.78 }, 'Wuhan': { lat: 30.59, lon: 114.30 },
                "Xi'an": { lat: 34.27, lon: 108.95 }, 'Suzhou': { lat: 31.30, lon: 120.62 },
            };
            const coord = coords[city] || { lat: 31.23, lon: 121.47 };

            const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
                params: { latitude: coord.lat, longitude: coord.lon, current_weather: true, timezone: 'Asia/Shanghai' },
                timeout: 8000
            });
            const w = res.data?.current_weather;
            if (!w) return null;

            const code = w.weathercode;
            let cond = '未知';
            if (code <= 1) cond = '晴';
            else if (code <= 3) cond = '多云';
            else if (code <= 48) cond = '阴';
            else if (code <= 67) cond = '雨';
            else if (code <= 77) cond = '雪';
            else if (code <= 82) cond = '阵雨';
            else if (code <= 99) cond = '雷雨';

            this.cache = {
                city: city, condition: cond, temp: `${w.temperature}°C`,
                feelsLike: '', humidity: '', wind: `${w.windspeed}km/h`, icon: '',
                raw: `${cond} ${w.temperature}°C`
            };
            this.cacheTime = Date.now();
            console.log(`🌤️ 天气(open-meteo): ${this.cache.raw}`);
            return this.cache;
        } catch (e) { return null; }
    }

    getWeatherDesc(weather) {
        if (!weather) return '';
        const cond = weather.condition.toLowerCase();
        const temp = parseInt(weather.temp) || 20;

        let mood = '';
        if (cond.includes('雨') || cond.includes('阴') || cond.includes('云')) {
            mood = '雨天/阴天，适合慵懒迷幻的氛围';
        } else if (cond.includes('晴')) {
            mood = temp > 30 ? '炎热晴天，适合清凉电子乐' : '晴朗温暖，适合欢快节奏';
        } else if (cond.includes('雪') || temp < 5) {
            mood = '寒冷天气，适合温暖治愈的音乐';
        } else if (temp > 28) {
            mood = '温暖偏热，适合清凉放松的曲风';
        } else {
            mood = '天气温和，适合各种风格';
        }

        return `当前${weather.city}天气：${weather.condition} ${weather.temp}，体感${weather.feelsLike || weather.temp}，湿度${weather.humidity || '未知'}，${weather.wind || '微风'}。${mood}`;
    }
}

module.exports = new WeatherService();
