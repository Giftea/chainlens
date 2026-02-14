"use client";

import { ParameterInfo } from "@/lib/abiAnalyzer";
import { AddressInput } from "./AddressInput";
import { NumberInput } from "./NumberInput";
import { BoolInput } from "./BoolInput";
import { HexInput } from "./HexInput";
import { TextInput } from "./TextInput";
import { ArrayInput } from "./ArrayInput";

/**
 * Renders the appropriate input component based on the parameter's inputType.
 * This is the central routing function for all playground form fields.
 */
export function renderInput(
  param: ParameterInfo,
  value: string,
  onChange: (value: string) => void,
  error?: string,
  disabled?: boolean,
) {
  const props = {
    name: param.name,
    type: param.type,
    value,
    onChange,
    placeholder: param.placeholder,
    error,
    example: param.example,
    disabled,
  };

  switch (param.inputType) {
    case "address":
      return <AddressInput {...props} />;
    case "number":
      return <NumberInput {...props} />;
    case "bool":
      return <BoolInput {...props} />;
    case "bytes":
      return <HexInput {...props} />;
    case "array":
      return <ArrayInput {...props} />;
    case "tuple":
      // Tuple/struct falls back to text input with JSON format hint
      return (
        <TextInput
          {...props}
          placeholder={param.placeholder || "JSON format: [val1, val2, ...]"}
        />
      );
    case "text":
    default:
      return <TextInput {...props} />;
  }
}
