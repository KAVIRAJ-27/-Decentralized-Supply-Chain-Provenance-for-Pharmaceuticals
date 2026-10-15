import React from 'react';
import { BatchStatus } from '../types';

interface Props {
  status: BatchStatus | string;
}

export const StatusBadge: React.FC<Props> = ({ status }) => {
  let className = 'badge badge-manufactured';
  let label = status.replace(/_/g, ' ');

  if (status.includes('IN_TRANSIT')) {
    className = 'badge badge-transit';
  } else if (status.includes('RECEIVED')) {
    className = 'badge badge-received';
  } else if (status === 'DISPENSED') {
    className = 'badge badge-dispensed';
  } else if (status === 'RECALLED') {
    className = 'badge badge-recalled';
    label = '⚠️ RECALLED';
  }

  return <span className={className}>{label}</span>;
};
