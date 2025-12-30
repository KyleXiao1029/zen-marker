import React, { useEffect, useState } from 'react';
import { t } from '../utils/i18n';

interface ModalProps {
  isOpen: boolean;
  title: string;
  desc?: string;
  fields?: { key: string; placeholder: string; value?: string }[];
  confirmText?: string;
  isDanger?: boolean;
  onConfirm: (data: Record<string, string>) => void;
  onCancel: () => void;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  desc,
  fields = [],
  confirmText = 'OK',
  isDanger = false,
  onConfirm,
  onCancel
}) => {
  const [formData, setFormData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      const initialData: Record<string, string> = {};
      fields.forEach(f => {
        initialData[f.key] = f.value || '';
      });
      setFormData(initialData);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleConfirm = () => {
    onConfirm(formData);
  };

  return (
    <div className={`modal-overlay ${isOpen ? 'active' : ''}`}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          {desc && <div className="modal-desc">{desc}</div>}
        </div>
        {(fields.length > 0) && (
             <div className="modal-body">
              {fields.map((field, idx) => (
                <input
                  key={field.key}
                  type="text"
                  className="modal-input"
                  placeholder={field.placeholder}
                  value={formData[field.key] || ''}
                  onChange={e => handleChange(field.key, e.target.value)}
                  onKeyUp={e => e.key === 'Enter' && handleConfirm()}
                  style={{ marginBottom: idx < fields.length - 1 ? 12 : 0 }}
                  autoFocus={idx === 0}
                />
              ))}
            </div>
        )}
        <div className="modal-footer">
          <button className="modal-btn cancel" onClick={onCancel}>
            {t('modalCancel')}
          </button>
          <button
            className={`modal-btn confirm ${isDanger ? 'danger' : ''}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
