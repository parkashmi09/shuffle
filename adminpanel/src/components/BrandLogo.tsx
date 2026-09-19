import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  BRAND_MARK_SRC,
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_WORDMARK_SRC,
} from '../constants/branding';

type BrandLogoProps = {
  /** Show "Operator console" under the wordmark */
  showTagline?: boolean;
  /** Full SVG wordmark only — no extra text (login header) */
  wordmark?: boolean;
  /** Icon mark only — no "Shuffle" text */
  markOnly?: boolean;
  /** Logo height in px */
  height?: number;
};

const BrandLogo: React.FC<BrandLogoProps> = ({
  showTagline = false,
  wordmark = false,
  markOnly = false,
  height = 28,
}) => {
  if (wordmark) {
    return (
      <Box
        component="img"
        src={BRAND_WORDMARK_SRC}
        alt={BRAND_NAME}
        sx={{ height, width: 'auto', maxWidth: '100%', display: 'block' }}
      />
    );
  }

  const markHeight = markOnly ? height : Math.min(height, 32);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
      <Box
        component="img"
        src={BRAND_MARK_SRC}
        alt=""
        aria-hidden
        sx={{ height: markHeight, width: markHeight, display: 'block', flexShrink: 0 }}
      />
      {!markOnly && (
        <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
          <Typography
            component="span"
            sx={{
              display: 'block',
              fontWeight: 700,
              fontSize: '1rem',
              letterSpacing: '0.02em',
              color: '#F9F9F9',
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {BRAND_NAME}
          </Typography>
          {showTagline && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: '#8384A5',
                lineHeight: 1.25,
                mt: 0.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {BRAND_TAGLINE}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

export default BrandLogo;
