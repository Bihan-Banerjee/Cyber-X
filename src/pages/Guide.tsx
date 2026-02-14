import React, { useMemo, useState } from 'react';
import './Guide.css';
import { TOPICS, GUIDE_CONTENT, TopicId } from './guideContent';

const Guide: React.FC = () => {
  const [activeTopic, setActiveTopic] = useState<TopicId>('overview');
  const [search, setSearch] = useState('');

  const filteredTopics = useMemo(
    () =>
      TOPICS.filter(t =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  );

  return (
    <div className="guide-shell">
      <div className="guide-frame">
        <header className="guide-frame-header">
          <h1>CYBERX GUIDE</h1>
          <span className="guide-header-pill">Docs</span>
        </header>

        <div className="guide-main">
          <aside className="guide-sidebar">
            <div className="guide-search">
              <span className="guide-search-icon">⌕</span>
              <input
                type="text"
                placeholder="Search topics..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="guide-topic-list">
              {filteredTopics.length === 0 && (
                <div className="guide-empty">No topics match your search.</div>
              )}
              {filteredTopics.map(topic => {
                const Icon = topic.icon;
                return (
                  <button
                    key={topic.id}
                    className={
                      'guide-topic-item' +
                      (topic.id === activeTopic ? ' guide-topic-item-active' : '')
                    }
                    onClick={() => setActiveTopic(topic.id)}
                  >
                    <div className="guide-topic-text">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {Icon && <Icon size={16} strokeWidth={2} />}
                        <span className="guide-topic-title">{topic.title}</span>
                      </div>
                    </div>
                    <span className="guide-topic-category">{topic.category}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="guide-content">
            {GUIDE_CONTENT[activeTopic] || (
              <div className="guide-empty">Topic content not found.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Guide;