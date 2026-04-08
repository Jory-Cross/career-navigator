import React from "react";
import TimeEntryWithIncrements from "./TimeEntryWithIncrements";

export default function ClockInOut({ clientId, clientName }) {
  // Always use time entry form with 15-minute increments
  return <TimeEntryWithIncrements clientId={clientId} clientName={clientName} />;

}