import React from 'react';

const LABEL_COLORS = {
  green: '#61bd4f',
  yellow: '#f2d600',
  orange: '#ff9f1a',
  red: '#eb5a46',
  purple: '#c377e0',
  blue: '#0079bf',
  sky: '#00c2e0',
  lime: '#51e898',
  pink: '#ff78cb',
  black: '#344563',
};

export default function RightPanel({ lists, cards, onCardClick }) {
  // Group cards by list
  const cardsByList = lists.reduce((acc, list) => {
    acc[list.id] = cards.filter((c) => c.idList === list.id);
    return acc;
  }, {});

  return (
    <aside style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>Board Lists</span>
        <span style={styles.headerCount}>{lists.length} lists</span>
      </div>

      {/* Horizontally scrollable list columns */}
      <div style={styles.scrollArea}>
        {lists.map((list) => {
          const listCards = cardsByList[list.id] || [];
          return (
            <div key={list.id} style={styles.column}>
              <div style={styles.columnHeader}>
                <span style={styles.columnName}>{list.name}</span>
                <span style={styles.columnCount}>{listCards.length}</span>
              </div>
              <div style={styles.cardScroll}>
                {listCards.length === 0 ? (
                  <div style={styles.emptyCol}>No cards</div>
                ) : (
                  listCards.map((card) => (
                    <CardTile
                      key={card.id}
                      card={card}
                      onClick={() => onCardClick && onCardClick(card)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function CardTile({ card, onClick }) {
  const hasDue = !!card.due;
  const dueDate = hasDue ? new Date(card.due) : null;
  const isOverdue = dueDate && dueDate < new Date();

  const formatDate = (d) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div style={styles.card} onClick={onClick}>
      {/* Labels */}
      {card.labels && card.labels.length > 0 && (
        <div style={styles.labels}>
          {card.labels.map((lbl, i) => (
            <span
              key={i}
              style={{
                ...styles.label,
                background: LABEL_COLORS[lbl.color] || '#666',
              }}
              title={lbl.name}
            />
          ))}
        </div>
      )}

      <span style={styles.cardName}>{card.name}</span>

      {hasDue && (
        <span
          style={{
            ...styles.dueChip,
            background: isOverdue
              ? 'rgba(235,90,70,0.18)'
              : 'rgba(97,189,79,0.14)',
            color: isOverdue ? '#ff8fa3' : '#61bd4f',
            border: `1px solid ${isOverdue ? 'rgba(235,90,70,0.35)' : 'rgba(97,189,79,0.3)'}`,
          }}
        >
          🕐 {formatDate(dueDate)}
        </span>
      )}
    </div>
  );
}

const styles = {
  panel: {
    width: 320,
    minWidth: 320,
    background: '#161b27',
    borderLeft: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    position: 'sticky',
    top: 0,
    flexShrink: 0,
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    minHeight: 52,
  },
  headerTitle: {
    color: '#e6edf3',
    fontWeight: 700,
    fontSize: 13,
  },
  headerCount: {
    background: 'rgba(255,255,255,0.07)',
    color: '#8b949e',
    fontSize: 11,
    borderRadius: 20,
    padding: '2px 8px',
  },
  // Horizontal scroll container
  scrollArea: {
    display: 'flex',
    flexDirection: 'row',
    overflowX: 'auto',
    overflowY: 'hidden',
    flex: 1,
    gap: 0,
    scrollSnapType: 'x mandatory',
    paddingBottom: 8,
  },
  column: {
    minWidth: 200,
    maxWidth: 200,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid rgba(255,255,255,0.05)',
    scrollSnapAlign: 'start',
  },
  columnHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    position: 'sticky',
    top: 0,
  },
  columnName: {
    color: '#c9d1d9',
    fontWeight: 600,
    fontSize: 12,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
  },
  columnCount: {
    background: 'rgba(255,255,255,0.08)',
    color: '#8b949e',
    fontSize: 10,
    borderRadius: 10,
    padding: '1px 6px',
    marginLeft: 6,
    flexShrink: 0,
  },
  cardScroll: {
    overflowY: 'auto',
    flex: 1,
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  emptyCol: {
    color: '#484f58',
    fontSize: 11,
    textAlign: 'center',
    padding: '20px 0',
  },
  card: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 8,
    padding: '9px 10px',
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  labels: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  },
  label: {
    height: 4,
    width: 28,
    borderRadius: 2,
    display: 'inline-block',
  },
  cardName: {
    color: '#c9d1d9',
    fontSize: 12,
    lineHeight: 1.4,
  },
  dueChip: {
    fontSize: 10,
    borderRadius: 4,
    padding: '2px 6px',
    alignSelf: 'flex-start',
    fontWeight: 500,
  },
};
