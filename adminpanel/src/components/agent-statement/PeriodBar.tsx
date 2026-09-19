/* Period selector: quick presets, a single-day picker, and a free date range.
   Emits a resolved { from, to } — the caller never has to do date maths. */
import React, { useState } from "react";
import { Box, Chip, TextField, Button, Typography } from "@mui/material";
import { PRESETS, Range, C, inputSx, todayIso } from "./ui";

interface Props {
  value: Range;
  activeKey: string;
  disabled?: boolean;
  onChange: (range: Range, key: string) => void;
}

const PeriodBar: React.FC<Props> = ({ value, activeKey, disabled, onChange }) => {
  const [day, setDay] = useState(value.from && value.from === value.to ? value.from : todayIso());
  const [from, setFrom] = useState(value.from || "");
  const [to, setTo] = useState(value.to || "");
  const [rangeError, setRangeError] = useState("");

  const applyRange = () => {
    if (!from || !to) { setRangeError("Pick both dates"); return; }
    if (from > to) { setRangeError("From must be on or before To"); return; }
    setRangeError("");
    onChange({ from, to }, "custom");
  };

  const chipSx = (active: boolean) => ({
    bgcolor: active ? "rgba(136,108,255,0.18)" : C.input,
    color: active ? C.text : C.sub,
    border: `1px solid ${active ? C.primary : C.border}`,
    fontWeight: active ? 600 : 500,
    "&:hover": { bgcolor: active ? "rgba(136,108,255,0.28)" : C.cardHover },
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {PRESETS.map((p) => (
          <Chip
            key={p.key}
            label={p.label}
            size="small"
            disabled={disabled}
            onClick={() => onChange(p.range(), p.key)}
            sx={chipSx(activeKey === p.key)}
          />
        ))}
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
        {/* Single day — "give me that one day, in full" */}
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Typography sx={{ color: C.sub, fontSize: 12, minWidth: 62 }}>Single day</Typography>
          <TextField
            type="date" size="small" value={day} disabled={disabled}
            onChange={(e) => setDay(e.target.value)}
            sx={{ ...inputSx, width: 165 }}
            InputLabelProps={{ shrink: true }}
          />
          <Button
            size="small" variant="outlined" disabled={disabled || !day}
            onClick={() => onChange({ from: day, to: day }, "day")}
            sx={{
              borderColor: activeKey === "day" ? C.primary : C.border,
              color: activeKey === "day" ? C.text : C.sub,
            }}
          >
            Show
          </Button>
        </Box>

        {/* Free range */}
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Typography sx={{ color: C.sub, fontSize: 12, minWidth: 62 }}>Range</Typography>
          <TextField
            type="date" size="small" label="From" value={from} disabled={disabled}
            onChange={(e) => setFrom(e.target.value)}
            sx={{ ...inputSx, width: 165 }} InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date" size="small" label="To" value={to} disabled={disabled}
            onChange={(e) => setTo(e.target.value)}
            sx={{ ...inputSx, width: 165 }} InputLabelProps={{ shrink: true }}
          />
          <Button
            size="small" variant="outlined" disabled={disabled}
            onClick={applyRange}
            sx={{
              borderColor: activeKey === "custom" ? C.primary : C.border,
              color: activeKey === "custom" ? C.text : C.sub,
            }}
          >
            Apply
          </Button>
        </Box>

        {rangeError && (
          <Typography sx={{ color: C.red, fontSize: 12, alignSelf: "center" }}>{rangeError}</Typography>
        )}
      </Box>
    </Box>
  );
};

export default PeriodBar;
