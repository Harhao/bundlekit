import React from "react";
import { CreateApp, ICreateAppParams } from "./CreateApp";
import { AddApp } from "./AddApp";

export type IAppCommand =
    | { command: "create"; params: ICreateAppParams }
    | { command: "add"; params: { plugin: string; cwd?: string } };

export const App: React.FC<IAppCommand> = (props) => {
    if (props.command === "create") return <CreateApp params={props.params} />;
    if (props.command === "add") return <AddApp params={props.params} />;
    return null;
};
