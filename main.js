// ==UserScript==
// @name         Discord Token Validator
// @namespace    https://github.com/Minhbeo8/
// @version      2.0.1
// @description  Discord Auto Token Extractor + Validator
// @author       Minhbeo8
// @match        *://discord.com/*
// @match        *://*.discord.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        unsafeWindow
// @run-at       document-start
// @noframes
// ==/UserScript==

(function() {
    'use strict';
    
    console.log(' Discord Token Validator -Starting...');
    
    let capturedToken = null;
    let capturedUser = null;
    
    function extractToken() {
        try {
            const token = localStorage.getItem('token');
            if (token && token.length > 50) {
                const cleanToken = token.replace(/"/g, '');
                if (cleanToken.includes('.')) {
                    capturedToken = cleanToken;
                    GM_setValue('discord_token', cleanToken);
                    console.log(' Token found from localStorage');
                    return cleanToken;
                }
            }
        } catch (e) {
            console.log('localStorage method failed');
        }
        
        try {
            if (window.webpackChunkdiscord_app) {
                window.webpackChunkdiscord_app.push([
                    [Math.random()], {}, (req) => {
                        for (const id of Object.keys(req.c)) {
                            try {
                                const module = req(id);
                                if (module?.default?.getToken) {
                                    const token = module.default.getToken();
                                    if (token && token.includes('.')) {
                                        capturedToken = token;
                                        GM_setValue('discord_token', token);
                                        console.log(' Token found from webpack');
                                        return token;
                                    }
                                }
                            } catch (e) {}
                        }
                    }
                ]);
            }
        } catch (e) {}
        
        return GM_getValue('discord_token') || null;
    }
    
    async function validateToken(token) {
        if (!token) return { valid: false, error: 'No token provided' };
        
        const tokenRegex = /^[A-Za-z0-9\-_]{24,}\.[A-Za-z0-9\-_]{6}\.[A-Za-z0-9\-_]{27,}$/;
        if (!tokenRegex.test(token)) {
            return { valid: false, error: 'Invalid token format' };
        }
        
        try {
            const response = await fetch('https://discord.com/api/v9/users/@me', {
                method: 'GET',
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const userData = await response.json();
                return {
                    valid: true,
                    user: userData,
                    tokenType: detectTokenType(token),
                    status: 'Active'
                };
            } else {
                let error = 'Unknown error';
                if (response.status === 401) error = 'Token expired or invalid';
                else if (response.status === 429) error = 'Rate limited';
                else if (response.status === 403) error = 'Access forbidden';
                
                return { valid: false, error: error, status: response.status };
            }
        } catch (err) {
            return { valid: false, error: 'Network error: ' + err.message };
        }
    }
    
    function detectTokenType(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return 'Invalid';
            
            const userIdBase64 = parts[0];
            const userId = atob(userIdBase64);
            
            return userId.length >= 17 ? 'User Token' : 'Bot Token';
        } catch (e) {
            return 'Unknown';
        }
    }
    
    function createUI() {
        const existing = document.getElementById('discord-validator-panel');
        if (existing) existing.remove();
        
        GM_addStyle(`
            #discord-validator-panel {
                position: fixed !important;
                top: 20px !important;
                right: 20px !important;
                width: 280px !important;
                background: #2f3136 !important;
                border: 2px solid #43b581 !important;
                border-radius: 8px !important;
                z-index: 999999 !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                color: #dcddde !important;
                box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important;
                font-size: 14px !important;
            }
            
            .validator-header {
                background: linear-gradient(135deg, #43b581, #5865f2) !important;
                padding: 12px 16px !important;
                border-radius: 6px 6px 0 0 !important;
                font-weight: 600 !important;
                color: white !important;
                position: relative !important;
            }
            
            .validator-close {
                position: absolute !important;
                right: 8px !important;
                top: 8px !important;
                background: rgba(255,255,255,0.1) !important;
                border: none !important;
                color: white !important;
                width: 24px !important;
                height: 24px !important;
                border-radius: 50% !important;
                cursor: pointer !important;
                font-size: 14px !important;
            }
            
            .validator-body {
                padding: 16px !important;
            }
            
            .validator-status {
                background: #40444b !important;
                padding: 8px 12px !important;
                border-radius: 4px !important;
                margin-bottom: 12px !important;
                font-size: 12px !important;
                border-left: 3px solid #43b581 !important;
            }
            
            .validator-token {
                background: #2f3136 !important;
                border: 1px solid #43b581 !important;
                border-radius: 4px !important;
                padding: 8px !important;
                font-family: monospace !important;
                font-size: 10px !important;
                word-break: break-all !important;
                margin-bottom: 8px !important;
                max-height: 60px !important;
                overflow-y: auto !important;
                color: #43b581 !important;
            }
            
            .validator-btn {
                width: 100% !important;
                padding: 10px 12px !important;
                border: none !important;
                border-radius: 4px !important;
                font-weight: 600 !important;
                cursor: pointer !important;
                margin-bottom: 6px !important;
                transition: all 0.2s !important;
                font-size: 13px !important;
            }
            
            .btn-verify { background: #43b581 !important; color: white !important; }
            .btn-verify:hover { background: #3ca374 !important; }
            .btn-copy { background: #5865f2 !important; color: white !important; }
            .btn-copy:hover { background: #4752c4 !important; }
            .btn-extract { background: #faa61a !important; color: white !important; }
            .btn-extract:hover { background: #e8941a !important; }
        `);
        
        const panel = document.createElement('div');
        panel.id = 'discord-validator-panel';
        panel.innerHTML = `
            <div class="validator-header">
                 Token Validator
                <button class="validator-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="validator-body">
                <div class="validator-status" id="validator-status">
                     Searching for token...
                </div>
                <div class="validator-token" id="validator-token">
                    Token will appear here...
                </div>
                <button class="validator-btn btn-verify" id="btn-verify"> Verify Token</button>
                <button class="validator-btn btn-copy" id="btn-copy"> Copy Token</button>
                <button class="validator-btn btn-extract" id="btn-extract"> Extract Token</button>
                <div style="font-size: 10px; color: #72767d; text-align: center; margin-top: 8px;">
                    Auto token extraction & validation
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
       
        bindEvents();
        setTimeout(autoExtract, 2000);
    }
    
    function bindEvents() {
        document.getElementById('btn-verify').addEventListener('click', async () => {
            const token = capturedToken || GM_getValue('discord_token');
            if (!token) {
                updateStatus(' No token to verify!');
                return;
            }
            
            updateStatus('🔍 Verifying token...');
            
            try {
                const result = await validateToken(token);
                showValidationResult(result);
                
                if (result.valid) {
                    updateStatus(` Valid token - ${result.user.username}#${result.user.discriminator}`);
                    updateTokenDisplay(token, true);
                } else {
                    updateStatus(` Invalid token - ${result.error}`);
                    updateTokenDisplay(token, false);
                }
            } catch (err) {
                updateStatus(` Verification failed: ${err.message}`);
            }
        });
        
        document.getElementById('btn-copy').addEventListener('click', () => {
            const token = capturedToken || GM_getValue('discord_token');
            if (!token) {
                alert(' No token to copy!');
                return;
            }
            
            if (navigator.clipboard) {
                navigator.clipboard.writeText(token).then(() => {
                    updateStatus(' Token copied to clipboard!');
                });
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = token;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                updateStatus(' Token copied!');
            }
        });
        
        document.getElementById('btn-extract').addEventListener('click', () => {
            autoExtract();
        });
    }
    
    function autoExtract() {
        updateStatus(' Extracting token...');
        
        const token = extractToken();
        if (token) {
            capturedToken = token;
            updateStatus(' Token extracted successfully!');
            updateTokenDisplay(token, null);
        } else {
            updateStatus(' No token found. Try refreshing page.');
        }
    }
    
    function updateStatus(message) {
        const statusEl = document.getElementById('validator-status');
        if (statusEl) {
            statusEl.textContent = message;
            console.log('Status:', message);
        }
    }
    
    function updateTokenDisplay(token, isValid) {
        const tokenEl = document.getElementById('validator-token');
        if (tokenEl && token) {
            const preview = token.substring(0, 32) + '...';
            tokenEl.textContent = preview;
            
            if (isValid === true) {
                tokenEl.style.borderColor = '#43b581';
                tokenEl.style.color = '#43b581';
            } else if (isValid === false) {
                tokenEl.style.borderColor = '#f04747';
                tokenEl.style.color = '#f04747';
            }
        }
    }
    
    function showValidationResult(result) {
        const existing = document.getElementById('validation-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'validation-modal';
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0,0,0,0.8) !important;
            z-index: 1000000 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 20px !important;
            box-sizing: border-box !important;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: #36393f !important;
            border-radius: 8px !important;
            padding: 20px !important;
            max-width: 400px !important;
            width: 100% !important;
            color: #dcddde !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            max-height: 80vh !important;
            overflow-y: auto !important;
        `;
        
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin: 0; color: ${result.valid ? '#43b581' : '#f04747'};">
                    ${result.valid ? ' Token Valid' : ' Token Invalid'}
                </h3>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                        style="background: none; border: none; color: #dcddde; font-size: 18px; cursor: pointer;">×</button>
            </div>
        `;
        
        if (result.valid && result.user) {
            html += `
                <div style="margin-bottom: 12px; padding: 12px; background: #43b58120; border-left: 3px solid #43b581; border-radius: 4px;">
                    <strong> User Information:</strong><br>
                    • Username: ${result.user.username}#${result.user.discriminator}<br>
                    • User ID: ${result.user.id}<br>
                    • Email Verified: ${result.user.verified ? ' Yes' : ' No'}<br>
                    • 2FA Enabled: ${result.user.mfa_enabled ? ' Yes' : ' No'}<br>
                    • Account Type: ${result.user.premium_type > 0 ? 'Nitro' : 'Regular'}
                </div>
                
                <div style="margin-bottom: 12px; padding: 12px; background: #5865f220; border-left: 3px solid #5865f2; border-radius: 4px;">
                    <strong> Token Details:</strong><br>
                    • Type: ${result.tokenType}<br>
                    • Status: ${result.status}<br>
                    • Format: Valid Discord Token
                </div>
            `;
        } else {
            html += `
                <div style="margin-bottom: 12px; padding: 12px; background: #f0474720; border-left: 3px solid #f04747; border-radius: 4px;">
                    <strong> Validation Error:</strong><br>
                    ${result.error}
                </div>
                
                <div style="margin-bottom: 12px; padding: 8px; background: #40444b; border-radius: 4px; font-size: 12px;">
                    <strong> Common Issues:</strong><br>
                    • Token expired or revoked<br>
                    • Account suspended/deleted<br>
                    • Invalid token format<br>
                    • API rate limiting
                </div>
            `;
        }
        
        html += `
            <div style="text-align: center; margin-top: 16px;">
                <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                        style="padding: 8px 16px; background: #5865f2; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        
        content.innerHTML = html;
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(createUI, 1000);
        });
    } else {
        setTimeout(createUI, 1000);
    }
    
    console.log(' Discord Token Validator initialized');
    
})();
