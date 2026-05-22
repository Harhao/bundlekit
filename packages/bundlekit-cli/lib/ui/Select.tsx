import React, { useState, useMemo, useEffect } from "react";
import { Box, Text, useInput } from "ink";

export interface ISelectItem<V = string> {
    label: string;
    value: V;
    disabled?: boolean;
    disabledReason?: string;
}

interface ISelectProps<V = string> {
    items: ISelectItem<V>[];
    initialValue?: V;
    onSelect: (value: V) => void;
    onBack?: () => void;
}

function findEnabledIndex<V>(items: ISelectItem<V>[], from: number, dir: 1 | -1): number {
    if (items.length === 0) return -1;
    const total = items.length;
    let idx = from;
    for (let i = 0; i < total; i++) {
        idx = (idx + dir + total) % total;
        if (!items[idx].disabled) return idx;
    }
    return -1;
}

export function Select<V extends string = string>(props: ISelectProps<V>) {
    const { items, initialValue, onSelect, onBack } = props;

    const initialIndex = useMemo(() => {
        if (initialValue) {
            const idx = items.findIndex((i) => i.value === initialValue && !i.disabled);
            if (idx >= 0) return idx;
        }
        const firstEnabled = items.findIndex((i) => !i.disabled);
        return firstEnabled >= 0 ? firstEnabled : 0;
    }, [items, initialValue]);

    const [selectedIndex, setSelectedIndex] = useState<number>(initialIndex);

    useEffect(() => {
        if (selectedIndex >= items.length || items[selectedIndex]?.disabled) {
            const firstEnabled = items.findIndex((i) => !i.disabled);
            setSelectedIndex(firstEnabled >= 0 ? firstEnabled : 0);
        }
    }, [items]);

    useInput((input, key) => {
        if (key.upArrow || input === "k") {
            const next = findEnabledIndex(items, selectedIndex, -1);
            if (next >= 0) setSelectedIndex(next);
            return;
        }
        if (key.downArrow || input === "j") {
            const next = findEnabledIndex(items, selectedIndex, 1);
            if (next >= 0) setSelectedIndex(next);
            return;
        }
        if (key.return) {
            const item = items[selectedIndex];
            if (item && !item.disabled) {
                onSelect(item.value);
            }
            return;
        }
        if ((key.escape || key.backspace || key.delete) && onBack) {
            onBack();
            return;
        }
    });

    return (
        <Box flexDirection="column">
            {items.map((item, index) => {
                const isSelected = index === selectedIndex;
                const disabled = !!item.disabled;
                const indicator = isSelected ? "▶ " : "  ";
                const color = disabled ? undefined : isSelected ? "cyan" : undefined;
                const dim = disabled || !isSelected;
                const suffix = disabled && item.disabledReason ? ` ${item.disabledReason}` : "";
                return (
                    <Box key={String(item.value)}>
                        <Text color={isSelected && !disabled ? "cyan" : undefined}>{indicator}</Text>
                        <Text color={color} dimColor={dim}>
                            {item.label}
                            {suffix}
                        </Text>
                    </Box>
                );
            })}
        </Box>
    );
}
