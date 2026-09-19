import { createTheme, alpha } from '@mui/material/styles';

const colors = {
  primary: '#886CFF',
  primaryHover: '#9B82FF',
  primaryLight: 'rgba(136, 108, 255, 0.2)',

  bg: '#0C0D1D',
  bgSurface: '#0C0D1D',
  bgCard: '#0E1831',
  bgCardLight: '#121E38',
  bgCardHover: '#162140',
  bgContrast: '#172244',
  bgInput: '#10182E',

  textPrimary: '#F9F9F9',
  textSecondary: '#8384A5',
  textMuted: '#878AA2',

  border: '#1E2D55',
  borderActive: '#886CFF',

  success: '#0ECC68',
  error: '#E01B4F',
  warning: '#FFC23F',
  info: '#A08FFF',

  buttonPrimary: '#886CFF',
  buttonSecondary: '#1A2550',
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: colors.primary,
      light: colors.primaryLight,
      dark: '#5F12CC',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: colors.buttonSecondary,
      light: '#243060',
      dark: '#111A3A',
      contrastText: '#F9F9F9',
    },
    error: {
      main: colors.error,
      light: alpha(colors.error, 0.2),
      dark: '#B01540',
    },
    warning: {
      main: colors.warning,
      light: alpha(colors.warning, 0.2),
      dark: '#CC9B32',
    },
    info: {
      main: colors.info,
      light: alpha(colors.info, 0.2),
      dark: '#3D62C5',
    },
    success: {
      main: colors.success,
      light: alpha(colors.success, 0.2),
      dark: '#0AA352',
    },
    background: {
      default: colors.bg,
      paper: colors.bgCard,
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      disabled: colors.textMuted,
    },
    divider: colors.border,
    action: {
      hover: alpha(colors.primary, 0.08),
      selected: alpha(colors.primary, 0.14),
      disabled: alpha(colors.textMuted, 0.38),
      disabledBackground: alpha(colors.buttonSecondary, 0.5),
    },
  },

  typography: {
    fontFamily: "'Montserrat', sans-serif",
    h1: {
      fontWeight: 700,
      fontSize: '2rem',
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 700,
      fontSize: '1.75rem',
      letterSpacing: '-0.01em',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.1rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
    },
    subtitle1: {
      fontWeight: 500,
      fontSize: '0.95rem',
      color: colors.textSecondary,
    },
    subtitle2: {
      fontWeight: 500,
      fontSize: '0.85rem',
      color: colors.textMuted,
    },
    body1: {
      fontSize: '0.938rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.85rem',
      lineHeight: 1.5,
      color: colors.textSecondary,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none' as const,
      letterSpacing: '0.02em',
    },
    caption: {
      fontSize: '0.75rem',
      color: colors.textMuted,
    },
    overline: {
      fontSize: '0.7rem',
      fontWeight: 600,
      letterSpacing: '0.08em',
      color: colors.textMuted,
    },
  },

  shape: {
    borderRadius: 10,
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: colors.bg,
          color: colors.textPrimary,
          scrollbarColor: `${colors.border} transparent`,
        },
      },
    },

    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundColor: colors.bgCard,
          backgroundImage: 'none',
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
        },
      },
    },

    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '10px 22px',
          fontWeight: 600,
          fontSize: '0.875rem',
          textTransform: 'none' as const,
          transition: 'all 0.2s ease',
        },
        containedPrimary: {
          backgroundColor: colors.buttonPrimary,
          color: '#FFFFFF',
          '&:hover': {
            backgroundColor: colors.primaryHover,
            boxShadow: `0 4px 16px ${alpha(colors.primary, 0.35)}`,
          },
        },
        containedSecondary: {
          backgroundColor: colors.buttonSecondary,
          color: colors.textPrimary,
          '&:hover': {
            backgroundColor: colors.bgContrast,
          },
        },
        outlined: {
          borderColor: colors.border,
          color: colors.textPrimary,
          '&:hover': {
            borderColor: colors.primary,
            backgroundColor: alpha(colors.primary, 0.08),
          },
        },
        text: {
          color: colors.textSecondary,
          '&:hover': {
            backgroundColor: alpha(colors.primary, 0.08),
            color: colors.primary,
          },
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        variant: 'outlined' as const,
        size: 'small' as const,
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: colors.bgInput,
            borderRadius: 10,
            fontSize: '0.875rem',
            '& fieldset': {
              borderColor: colors.border,
              transition: 'border-color 0.2s ease',
            },
            '&:hover fieldset': {
              borderColor: alpha(colors.primary, 0.5),
            },
            '&.Mui-focused fieldset': {
              borderColor: colors.borderActive,
              borderWidth: 1,
            },
          },
          '& .MuiInputLabel-root': {
            color: colors.textMuted,
            fontSize: '0.875rem',
            '&.Mui-focused': {
              color: colors.primary,
            },
          },
          '& .MuiOutlinedInput-input': {
            color: colors.textPrimary,
            '&::placeholder': {
              color: colors.textMuted,
              opacity: 1,
            },
          },
        },
      },
    },

    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: colors.bgInput,
          borderRadius: 10,
          fontSize: '0.875rem',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.border,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(colors.primary, 0.5),
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.borderActive,
            borderWidth: 1,
          },
        },
        icon: {
          color: colors.textMuted,
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: colors.border,
          color: colors.textSecondary,
          fontSize: '0.85rem',
          padding: '14px 16px',
        },
        head: {
          backgroundColor: colors.bgContrast,
          color: colors.textMuted,
          fontWeight: 700,
          fontSize: '0.75rem',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.06em',
          borderBottomColor: colors.border,
        },
      },
    },

    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            backgroundColor: colors.bgContrast,
            borderBottom: `2px solid ${colors.border}`,
          },
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.15s ease',
          '&:hover': {
            backgroundColor: `${colors.bgCardHover} !important`,
          },
          '&:last-child td': {
            borderBottom: 0,
          },
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.bgCard,
          backgroundImage: 'none',
          borderRight: `1px solid ${colors.border}`,
          borderRadius: 0,
        },
      },
    },

    MuiAppBar: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundColor: colors.bgCard,
          backgroundImage: 'none',
          borderRadius: 0,
          border: 'none',
          borderBottom: `1px solid ${colors.border}`,
          color: colors.textPrimary,
        },
      },
    },

    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundColor: colors.bgCard,
          backgroundImage: 'none',
          border: `1px solid ${colors.border}`,
          borderRadius: 14,
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: colors.bgCardHover,
            borderColor: alpha(colors.primary, 0.3),
          },
        },
      },
    },

    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '20px',
          '&:last-child': {
            paddingBottom: '20px',
          },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          fontSize: '0.75rem',
          height: 28,
        },
        filled: {
          backgroundColor: colors.bgContrast,
          color: colors.textPrimary,
          border: `1px solid ${colors.border}`,
        },
        colorPrimary: {
          backgroundColor: alpha(colors.primary, 0.15),
          color: colors.primary,
          border: 'none',
        },
        colorSuccess: {
          backgroundColor: alpha(colors.success, 0.15),
          color: colors.success,
          border: 'none',
        },
        colorError: {
          backgroundColor: alpha(colors.error, 0.15),
          color: colors.error,
          border: 'none',
        },
        colorWarning: {
          backgroundColor: alpha(colors.warning, 0.15),
          color: colors.warning,
          border: 'none',
        },
        colorInfo: {
          backgroundColor: alpha(colors.info, 0.15),
          color: colors.info,
          border: 'none',
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.bgCard,
          backgroundImage: 'none',
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          boxShadow: `0 24px 48px ${alpha('#000000', 0.5)}`,
        },
      },
    },

    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          fontSize: '1.15rem',
          padding: '20px 24px',
          borderBottom: `1px solid ${colors.border}`,
        },
      },
    },

    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '16px 24px',
          borderTop: `1px solid ${colors.border}`,
        },
      },
    },

    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.bgCardLight,
          backgroundImage: 'none',
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          boxShadow: `0 12px 32px ${alpha('#000000', 0.45)}`,
          marginTop: 4,
        },
      },
    },

    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          padding: '10px 16px',
          borderRadius: 6,
          margin: '2px 6px',
          transition: 'all 0.15s ease',
          '&:hover': {
            backgroundColor: alpha(colors.primary, 0.1),
          },
          '&.Mui-selected': {
            backgroundColor: alpha(colors.primary, 0.15),
            '&:hover': {
              backgroundColor: alpha(colors.primary, 0.2),
            },
          },
        },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none' as const,
          fontWeight: 600,
          fontSize: '0.875rem',
          color: colors.textMuted,
          minHeight: 48,
          padding: '12px 20px',
          transition: 'color 0.2s ease',
          '&:hover': {
            color: colors.textPrimary,
          },
          '&.Mui-selected': {
            color: colors.primary,
          },
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 48,
        },
        indicator: {
          backgroundColor: colors.primary,
          height: 3,
          borderRadius: '3px 3px 0 0',
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colors.bgContrast,
          color: colors.textPrimary,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          fontSize: '0.75rem',
          fontWeight: 500,
          padding: '8px 12px',
        },
        arrow: {
          color: colors.bgContrast,
        },
      },
    },

    MuiSwitch: {
      styleOverrides: {
        root: {
          '& .MuiSwitch-track': {
            backgroundColor: colors.border,
            opacity: 1,
          },
          '& .Mui-checked + .MuiSwitch-track': {
            backgroundColor: `${alpha(colors.primary, 0.5)} !important`,
            opacity: '1 !important',
          },
        },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: colors.border,
        },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 8px',
          padding: '10px 14px',
          transition: 'all 0.15s ease',
          '&:hover': {
            backgroundColor: alpha(colors.primary, 0.08),
          },
          '&.Mui-selected': {
            backgroundColor: alpha(colors.primary, 0.14),
            color: colors.primary,
            '&:hover': {
              backgroundColor: alpha(colors.primary, 0.18),
            },
          },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          color: colors.textSecondary,
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: alpha(colors.primary, 0.1),
            color: colors.primary,
          },
        },
      },
    },

    MuiPagination: {
      styleOverrides: {
        root: {
          '& .MuiPaginationItem-root': {
            color: colors.textSecondary,
            borderColor: colors.border,
            '&:hover': {
              backgroundColor: alpha(colors.primary, 0.1),
            },
            '&.Mui-selected': {
              backgroundColor: colors.primary,
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: colors.primaryHover,
              },
            },
          },
        },
      },
    },

    MuiBadge: {
      styleOverrides: {
        colorPrimary: {
          backgroundColor: colors.primary,
        },
        colorError: {
          backgroundColor: colors.error,
        },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: colors.bgContrast,
          borderRadius: 4,
          height: 6,
        },
        barColorPrimary: {
          backgroundColor: colors.primary,
          borderRadius: 4,
        },
      },
    },

    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(colors.border, 0.4),
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontSize: '0.85rem',
          fontWeight: 500,
        },
        standardSuccess: {
          backgroundColor: alpha(colors.success, 0.12),
          color: colors.success,
          border: `1px solid ${alpha(colors.success, 0.25)}`,
        },
        standardError: {
          backgroundColor: alpha(colors.error, 0.12),
          color: colors.error,
          border: `1px solid ${alpha(colors.error, 0.25)}`,
        },
        standardWarning: {
          backgroundColor: alpha(colors.warning, 0.12),
          color: colors.warning,
          border: `1px solid ${alpha(colors.warning, 0.25)}`,
        },
        standardInfo: {
          backgroundColor: alpha(colors.info, 0.12),
          color: colors.info,
          border: `1px solid ${alpha(colors.info, 0.25)}`,
        },
      },
    },
  },
});

export default theme;
export { colors };
