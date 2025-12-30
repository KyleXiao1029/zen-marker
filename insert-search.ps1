// 临时脚本：在 Manager.tsx 的327行后插入快捷搜索区域
$content = Get-Content 'd:\Projects\zen-marker\src\manager\Manager.tsx' -Raw
$insertPoint = $content.IndexOf('                )')
$insertPoint = $content.IndexOf("
", $insertPoint) + 2
$insertPoint = $content.IndexOf("
", $insertPoint) + 2  # 跳过空行到 section-title

$newCode = @'

                {/* Quick Search Section */}
                {!searchQuery && (
                    <div className="quick-search-section">
                        <div className="section-header">
                            <h2 className="section-title-inline">{t('quickSearch')}</h2>
                            <button className="manage-engines-btn" onClick={() => setShowEngineConfig(!showEngineConfig)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="3"/>
                                    <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
                                </svg>
                                {t('manageEngines')}
                            </button>
                        </div>

                        <div className="search-engines-container">
                            {searchEngines.filter(e => e.enabled).map(engine => (
                                <div key={engine.id} className="search-engine-item">
                                    <div className="engine-icon">
                                        {engine.icon ? (
                                            <img src={engine.icon} alt={engine.name} onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                                                if (sibling) sibling.classList.remove('hidden');
                                            }} />
                                        ) : null}
                                        <svg className={engine.icon ? 'hidden' : ''} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                        </svg>
                                    </div>
                                    <div className="engine-name">{engine.name}</div>
                                    <div className="engine-search">
                                        <input 
                                            type="text"
                                            className="engine-input"
                                            placeholder={t('quickSearchPlaceholder', engine.name)}
                                            value={searchInputs[engine.id] || ''}
                                            onChange={(e) => handleSearchInputChange(engine.id, e.target.value)}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleEngineSearch(engine, searchInputs[engine.id] || '');
                                                }
                                            }}
                                        />
                                        <button 
                                            className="engine-search-btn"
                                            onClick={() => handleEngineSearch(engine, searchInputs[engine.id] || '')}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {showEngineConfig && (
                            <div className="engine-config-panel">
                                <div className="config-header">
                                    <h3>{t('searchEngineConfig')}</h3>
                                    <button className="close-btn" onClick={() => setShowEngineConfig(false)}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                        </svg>
                                    </button>
                                </div>
                                <div className="config-body">
                                    {searchEngines.map(engine => (
                                        <div key={engine.id} className="config-engine-item">
                                            <label className="engine-toggle">
                                                <input 
                                                    type="checkbox" 
                                                    checked={engine.enabled}
                                                    onChange={() => toggleEngine(engine.id)}
                                                />
                                                <span className="toggle-slider"></span>
                                                <span className="engine-label">{engine.name}</span>
                                            </label>
                                            {!engine.id.startsWith('google') && !engine.id.startsWith('bing') && 
                                             !engine.id.startsWith('yahoo') && !engine.id.startsWith('baidu') && 
                                             !engine.id.startsWith('duckduckgo') && (
                                                <button 
                                                    className="remove-engine-btn"
                                                    onClick={() => removeEngine(engine.id)}
                                                >
                                                    {t('removeEngine')}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button 
                                        className="add-engine-btn"
                                        onClick={() => {
                                            const name = prompt(t('engineName'));
                                            if (name) {
                                                const url = prompt(t('engineUrl'));
                                                if (url) {
                                                    const icon = prompt(t('engineIcon'));
                                                    addNewEngine(name, url, icon || undefined);
                                                }
                                            }
                                        }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                        </svg>
                                        {t('addEngine')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

'@

$newContent = $content.Insert($insertPoint, $newCode)
$newContent | Set-Content 'd:\Projects\zen-marker\src\manager\Manager.tsx' -Encoding UTF8 -NoNewline
Write-Host "Successfully inserted quick search section"
