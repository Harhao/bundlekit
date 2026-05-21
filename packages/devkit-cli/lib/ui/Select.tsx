import React from "react";
import SelectInput from "ink-select-input";

export interface ISelectItem<V = string> {
    label: string;
    value: V;
}

interface ISelectProps<V = string> {
    items: ISelectItem<V>[];
    initialValue?: V;
    onSelect: (value: V) => void;
}

export function Select<V extends string = string>(props: ISelectProps<V>) {
    const { items, onSelect, initialValue } = props;
    return (
        <SelectInput
            items={items}
            initialIndex={
                initialValue ? Math.max(0, items.findIndex((i) => i.value === initialValue)) : 0
            }
            onSelect={(item) => onSelect(item.value as V)}
        />
    );
}
