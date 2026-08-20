import { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface ColorTagsInputProps {
  value: string[];
  onChange: (colors: string[]) => void;
  placeholder?: string;
}

export function ColorTagsInput({ value, onChange, placeholder = 'Type a color and press Enter' }: ColorTagsInputProps) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const tag = input.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && input === '' && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800">
      {value.map((color) => (
        <span
          key={color}
          className="inline-flex items-center gap-1 rounded-md bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
        >
          {color}
          <button
            type="button"
            onClick={() => removeTag(color)}
            className="text-brand-400 hover:text-brand-600 dark:hover:text-brand-200"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] border-0 bg-transparent px-1 py-0.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder-slate-500"
      />
    </div>
  );
}
