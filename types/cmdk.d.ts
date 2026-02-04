declare module 'cmdk' {
  import * as React from 'react';

  type DivProps = React.HTMLAttributes<HTMLDivElement>;
  type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    onValueChange?: (value: string) => void;
  };

  type GroupProps = DivProps & {
    heading?: string;
  };

  type ItemProps = DivProps & {
    value?: string;
    onSelect?: (value: string) => void;
  };

  interface CommandComponent
    extends React.ForwardRefExoticComponent<DivProps & React.RefAttributes<HTMLDivElement>> {
    Input: React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>>;
    List: React.ForwardRefExoticComponent<DivProps & React.RefAttributes<HTMLDivElement>>;
    Item: React.ForwardRefExoticComponent<ItemProps & React.RefAttributes<HTMLDivElement>>;
    Group: React.ForwardRefExoticComponent<GroupProps & React.RefAttributes<HTMLDivElement>>;
    Separator: React.ForwardRefExoticComponent<DivProps & React.RefAttributes<HTMLDivElement>>;
    Empty: React.ForwardRefExoticComponent<DivProps & React.RefAttributes<HTMLDivElement>>;
  }

  const Command: CommandComponent;

  export { Command };
}
