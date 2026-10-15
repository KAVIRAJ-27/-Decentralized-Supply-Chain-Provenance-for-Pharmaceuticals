import React from 'react';
import { CustodyEvent } from '../types';
import { RoleBadge } from './RoleBadge';

interface Props {
  events: CustodyEvent[] | any[];
}

export const Timeline: React.FC<Props> = ({ events }) => {
  if (!events || events.length === 0) {
    return <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>No custody records found.</p>;
  }

  return (
    <div style={{ position: 'relative', paddingLeft: '24px', margin: '20px 0' }}>
      {/* Vertical line */}
      <div
        style={{
          position: 'absolute',
          left: '7px',
          top: '10px',
          bottom: '10px',
          width: '2px',
          background: 'linear-gradient(180deg, #00d2b4 0%, #38bdf8 50%, rgba(255,255,255,0.1) 100%)',
        }}
      />

      {events.map((evt, idx) => {
        const isRecalled = evt.status === 'RECALLED' || evt.action.includes('RECALL');
        const nodeColor = isRecalled ? '#ef4444' : '#00d2b4';

        return (
          <div key={evt.id || idx} style={{ position: 'relative', marginBottom: '24px' }}>
            {/* Timeline bullet */}
            <div
              style={{
                position: 'absolute',
                left: '-24px',
                top: '4px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: nodeColor,
                border: '3px solid #070a12',
                boxShadow: `0 0 10px ${nodeColor}80`,
              }}
            />

            <div
              style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: isRecalled ? '#f87171' : '#f8fafc' }}>
                    {evt.action.replace(/_/g, ' ')}
                  </span>
                  <RoleBadge role={evt.actorRole} />
                </div>
                <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  {new Date(evt.timestamp).toLocaleString()}
                </span>
              </div>

              <div style={{ marginTop: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <strong>Actor:</strong> {evt.actorName}
                {evt.location && <span> &bull; <strong>Location:</strong> {evt.location}</span>}
                {evt.temperatureCelsius !== undefined && (
                  <span>
                    {' '}&bull; <strong>Temp:</strong>{' '}
                    <span style={{ color: evt.temperatureCelsius > 8 || evt.temperatureCelsius < 2 ? '#fbbf24' : '#34d399' }}>
                      {evt.temperatureCelsius}°C
                    </span>
                  </span>
                )}
              </div>

              {evt.notes && (
                <div style={{ marginTop: '6px', fontSize: '0.82rem', color: '#cbd5e1', fontStyle: 'italic' }}>
                  &ldquo;{evt.notes}&rdquo;
                </div>
              )}

              {evt.blockchainTxHash && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--primary)' }}>
                    Tx: {evt.blockchainTxHash.substring(0, 18)}...{evt.blockchainTxHash.substring(evt.blockchainTxHash.length - 8)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
