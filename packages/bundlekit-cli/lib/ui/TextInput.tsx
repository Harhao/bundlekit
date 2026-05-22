import React from "react";
import InkTextInput from "ink-text-input";

interface ITextInputProps {
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
    onSubmit: (value: string) => void;
}

export const TextInput: React.FC<ITextInputProps> = ({ value, placeholder, onChange, onSubmit }) => {
    return (
        <InkTextInput
            value={value}
            placeholder={placeholder}
            onChange={onChange}
            onSubmit={onSubmit}
        />
    );
};
