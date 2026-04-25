import { useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";

interface ListInlineEditProps {
  id: string;
  value: string;
  onSave: (input: { id: string; name: string; }) => void;
  disabled?: boolean,
  className?: string;
  inputClassName?: string;
  displayClassName?: string;
}

export default function ListInlineEdit({
  id,
  value,
  onSave,
  disabled = false,
  className = "",
  inputClassName = "",
  displayClassName = "",
}: ListInlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [displayValue, setDisplayValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEditing = () => {
    setEditValue(value);
    setDisplayValue(value);
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmed = editValue.trim();

    if (!trimmed) {
      setEditValue(value);
      setDisplayValue(value);
      setIsEditing(false);
      return;
    }

    if (trimmed !== value) {
      // Local instant UI
      setDisplayValue(trimmed);

      // Cache/server mutation
      onSave({
        id,
        name: trimmed,
      });
    }

    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setDisplayValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing && !disabled) {
    return (
      <Input
        ref={inputRef}
        value={editValue}
        disabled={disabled}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`${className} ${inputClassName} focus-visible:ring-0 border-0 pl-0!`}
      />
    );
  }

  return (
    <span
      onClick={startEditing}
      className={`${className} ${displayClassName} cursor-pointer rounded transition-colors inline-block w-full`}
    >
      {displayValue}
    </span>
  );
}