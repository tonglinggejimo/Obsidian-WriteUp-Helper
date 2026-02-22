/**
 * 平台配置文件
 * 定义不同CTF平台的特定配置和选择器
 */

const PLATFORM_CONFIGS = {
    'nssctf.cn': {
        name: 'NSSCTF',
        defaultBasePath: '网安/练习WP/NSSCTF',
        titleProcessor: (title) => {
            // NSSCTF特定的标题处理逻辑
            title = title.split('|')[0].trim();
            title = title.replace(/[?|:<>"*\/\\]/g, '');

            const bracketRegex = /\[([^\]]+)\]/g;
            const bracketContents = [];
            let match;

            while ((match = bracketRegex.exec(title)) !== null) {
                bracketContents.push(match[1].trim());
            }

            const problemName = title.split(']').pop().trim();
            let formattedTitle = bracketContents.join('-');

            if (problemName && problemName !== formattedTitle) {
                formattedTitle = formattedTitle ? `${formattedTitle}-${problemName}` : problemName;
            }

            return formattedTitle.replace(/[-\s]+/g, '-').replace(/^-+|-+$/g, '') || 'Unknown';
        }
    },

    'ctf.show': {
        name: 'CTF Show',
        defaultBasePath: '网安/练习WP/CTFShow',
        titleProcessor: (title) => {
            // CTF Show特定的标题处理逻辑
            title = title.replace(/CTF Show/gi, '').trim();
            title = title.replace(/[?|:<>"*\/\\]/g, '');
            return title.replace(/[-\s]+/g, '-').replace(/^-+|-+$/g, '') || 'Unknown';
        }
    },

    'buuoj.cn': {
        name: 'BUUOJ',
        defaultBasePath: '网安/练习WP/BUUOJ',
        titleProcessor: (title) => {
            // BUUOJ特定的标题处理逻辑
            title = title.replace(/BUUOJ/gi, '').trim();
            title = title.replace(/[?|:<>"*\/\\]/g, '');
            return title.replace(/[-\s]+/g, '-').replace(/^-+|-+$/g, '') || 'Unknown';
        }
    },

    'xj.edisec.net': {
        name: '玄机',
        defaultBasePath: '网安/练习WP/玄机',
        titleProcessor: (title) => {
            // 玄机平台特定的标题处理逻辑
            // 移除平台名称，提取题目相关信息
            title = title.replace(/玄机/gi, '').replace(/[|—\-]/g, ' ').trim();
            title = title.replace(/[?|:<>"*\/\\]/g, '');
            return title.replace(/[-\s]+/g, '-').replace(/^-+|-+$/g, '') || 'Unknown';
        },
        /**
         * 从玄机平台 API 提取题目描述和步骤
         * 数据来源于 network 中的 challenges/:id 接口
         * @returns {Promise<string>} 格式化的步骤内容，用于写入WP模板
         */
        stepsExtractor: async () => {
            try {
                // 从 URL 提取题目 ID，如 /challenges/380 -> 380
                const match = window.location.pathname.match(/\/challenges\/(\d+)/);
                const challengeId = match ? match[1] : null;
                if (!challengeId) return '';

                // 玄机 API 路径：/v1/challenges/:id（无 api 前缀）
                const apiUrl = `https://xj.edisec.net/v1/challenges/${challengeId}`;
                const headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'x-target': 'API'
                };
                // 尝试从 localStorage/sessionStorage 获取 token（玄机登录后存储）
                try {
                    const keys = ['__TOKEN__', 'token', 'access_token', 'accessToken', 'jwt', 'auth_token', 'authToken', 'user', 'auth'];
                    let token = null;
                    for (const k of keys) {
                        const raw = localStorage.getItem(k) || sessionStorage.getItem(k);
                        if (raw) {
                            if (raw.startsWith('{')) {
                                try {
                                    const obj = JSON.parse(raw);
                                    token = obj.token || obj.access_token || obj.accessToken || obj.jwt;
                                } catch (_) {
                                    token = raw;
                                }
                            } else {
                                token = raw;
                            }
                            if (token) break;
                        }
                    }
                    if (token) headers['Authorization'] = 'Bearer ' + token;
                } catch (e) { /* 忽略 */ }
                const fetchOpts = { credentials: 'include', headers };

                const resp = await fetch(apiUrl, fetchOpts);
                if (!resp.ok) return '';
                const json = await resp.json();
                const data = json.data || json;
                if (!data || (!data.description && (!data.steps || data.steps.length === 0))) return '';

                const parts = [];

                // 1. 总题目描述
                if (data.description) {
                    let desc = data.description;
                    if (typeof desc === 'string') {
                        desc = desc.replace(/^!!!MARKDOWN!!!\s*/i, '').trim();
                        if (desc) {
                            parts.push(`## 题目描述\n\n${desc}`);
                        }
                    }
                }

                // 2. 各步骤的 name + description
                const steps = data.steps || [];
                if (steps.length > 0) {
                    const stepBlocks = steps.map((s, i) => {
                        const num = i + 1;
                        const name = (s.name || `步骤 ${num}`).trim();
                        let stepDesc = (s.description || '').trim();
                        stepDesc = stepDesc.replace(/^!!!MARKDOWN!!!\s*/i, '');
                        let md = `### 步骤 ${num}：${name}\n\n`;
                        if (stepDesc) md += stepDesc + '\n\n';
                        md += '**解答**：\n\n';
                        return md;
                    });
                    parts.push('## 题目步骤\n\n' + stepBlocks.join('---\n\n'));
                }

                if (parts.length === 0) return '';
                return parts.join('\n\n---\n\n');
            } catch (e) {
                console.warn('WriteUp Helper: 玄机 API 步骤提取失败', e);
                return '';
            }
        }
    },

    'codewars.com': {
        name: 'Codewars',
        defaultBasePath: '编程/Codewars',
        titleProcessor: (title) => {
            // Codewars 标题格式: "Strip Comments | Codewars"
            title = title.replace(/\s*\|\s*Codewars\s*$/i, '').trim();
            title = title.replace(/[?|:<>"*\/\\]/g, '');
            return title.trim() || 'Unknown';
        },
        /**
         * 从 Codewars 页面提取题目描述
         * 数据来源于页面内嵌的 App.setup() JSON 数据
         * @returns {string} 格式化的描述内容（已添加 Obsidian callout 前缀）
         */
        descriptionExtractor: () => {
            try {
                let rawDesc = '';

                // 方法1：从内嵌的 App.setup() 脚本中提取 JSON 数据
                const scripts = document.querySelectorAll('script:not([src])');
                for (const script of scripts) {
                    const text = script.textContent;
                    if (!text.includes('challengeName')) continue;

                    const match = text.match(/JSON\.parse\("((?:[^"\\]|\\[\s\S])*)"\)/);
                    if (match) {
                        try {
                            const jsonStr = JSON.parse('"' + match[1] + '"');
                            const data = JSON.parse(jsonStr);
                            if (data.description) {
                                rawDesc = data.description;
                                break;
                            }
                        } catch (e) {
                            console.warn('WriteUp Helper: Codewars 内嵌数据解析失败', e);
                        }
                    }
                }

                // 方法2：从 DOM #description 元素提取
                if (!rawDesc) {
                    const descEl = document.querySelector('#description');
                    if (descEl) {
                        const text = descEl.innerText.trim();
                        if (text && text !== 'Loading description...') {
                            rawDesc = text;
                        }
                    }
                }

                // 方法3：从 og:description meta 标签提取（可能被截断）
                if (!rawDesc) {
                    const metaDesc = document.querySelector('meta[property="og:description"]');
                    if (metaDesc && metaDesc.content) {
                        rawDesc = metaDesc.content;
                    }
                }

                if (!rawDesc) return '';

                // 格式化为 Obsidian callout 块：每行添加 "> " 前缀
                return rawDesc.split('\n').map(line => `> ${line}`).join('\n');
            } catch (e) {
                console.warn('WriteUp Helper: Codewars 描述提取失败', e);
                return '';
            }
        }
    }
};

/**
 * 默认模板配置
 */
const DEFAULT_TEMPLATES = {
    standard: {
        name: '标准模板',
        content: `## 基本信息
- **题目名称**：{{title}}
- **题目链接**：{{url}}
- **创建时间**：{{date}} {{time}}
- **考点清单**：

## 解题思路


## 过程和结果记录


## 总结


## 相关知识点


---
*Generated by Obsidian WriteUp Helper*`
    },
    
    detailed: {
        name: '详细模板',
        content: `# {{title}}

## 📋 基本信息
| 项目 | 内容 |
|------|------|
| 题目名称 | {{title}} |
| 题目链接 | {{url}} |
| 创建时间 | {{date}} {{time}} |

## 🎯 考点清单
- [ ]

## 💡 解题思路


## 📝 过程和结果记录


## 🔍 详细分析


## 📚 相关知识点


## 🎉 总结


## 🔗 参考资料


---
*Generated by Obsidian WriteUp Helper v2.0*`
    },
    
    simple: {
        name: '简洁模板',
        content: `# {{title}}

**链接**: {{url}}
**时间**: {{date}}

## 思路


## 过程


## 总结

`
    },

    xuanji: {
        name: '玄机模板',
        content: `## 基本信息
- **题目名称**：{{title}}
- **题目链接**：{{url}}
- **创建时间**：{{date}} {{time}}
- **平台**：玄机 (xj.edisec.net)
- **考点清单**：

## 题目内容

{{steps}}

## 解题思路


## 过程和结果记录


## 总结


## 相关知识点


---
*Generated by Obsidian WriteUp Helper*`
    },

    codewars: {
        name: 'Codewars模板',
        content: `# 题目：{{title}}

题目链接：[{{title}}]({{url}})

> [!NOTE] 题目
{{description}}

# 我的解决方法：

\`\`\`python

\`\`\`

# 我认为最好的评论区解法：

\`\`\`python

\`\`\`
`
    }
};

/**
 * 获取当前平台配置
 * @returns {Object} 平台配置对象
 */
function getCurrentPlatformConfig() {
    try {
        if (typeof window === 'undefined' || !window.location) {
            console.warn('WriteUp Helper: 无法获取window.location，使用默认配置');
            return PLATFORM_CONFIGS['nssctf.cn'];
        }

        const hostname = window.location.hostname;

        for (const [domain, config] of Object.entries(PLATFORM_CONFIGS)) {
            if (hostname.includes(domain)) {
                return config;
            }
        }

        // 返回默认配置
        return PLATFORM_CONFIGS['nssctf.cn'];
    } catch (error) {
        console.error('WriteUp Helper: 获取平台配置失败', error);
        return PLATFORM_CONFIGS['nssctf.cn'];
    }
}

/**
 * 导出配置
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PLATFORM_CONFIGS,
        DEFAULT_TEMPLATES,
        getCurrentPlatformConfig
    };
}
