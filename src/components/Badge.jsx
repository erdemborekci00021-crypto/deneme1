import React from "react";
import { riskNames } from "../utils.js";
export default function Badge({ risk }) {
  return (
    <span className={"badge " + risk}>
      <i />
      {riskNames[risk]}
    </span>
  );
}
