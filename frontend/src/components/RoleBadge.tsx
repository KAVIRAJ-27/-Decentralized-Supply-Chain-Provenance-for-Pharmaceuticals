import React from 'react';
import { UserRole } from '../types';

interface Props {
  role: UserRole | string;
}

export const RoleBadge: React.FC<Props> = ({ role }) => {
  let color = '#38bdf8';
  let bg = 'rgba(56, 189, 248, 0.12)';
  let border = 'rgba(56, 189, 248, 0.3)';

  switch (role) {
    case 'ADMIN':
      color = '#f59e0b';
      bg = 'rgba(245, 158, 11, 0.12)';
      border = 'rgba(245, 158, 11, 0.3)';
      break;
    case 'MANUFACTURER':
      color = '#00d2b4';
      bg = 'rgba(0, 210, 180, 0.12)';
      border = 'rgba(0, 210, 180, 0.3)';
      break;
    case 'DISTRIBUTOR':
      color = '#38bdf8';
      bg = 'rgba(56, 189, 248, 0.12)';
      border = 'rgba(56, 189, 248, 0.3)';
      break;
    case 'PHARMACY':
      color = '#10b981';
      bg = 'rgba(16, 185, 129, 0.12)';
      border = 'rgba(16, 185, 129, 0.3)';
      break;
    case 'CONSUMER':
      color = '#a855f7';
      bg = 'rgba(168, 85, 247, 0.12)';
      border = 'rgba(168, 85, 247, 0.3)';
      break;
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '0.72rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        color,
        background: bg,
        border: `1px solid ${border}`,
        textTransform: 'uppercase',
      }}
    >
      {role}
    </span>
  );
};
