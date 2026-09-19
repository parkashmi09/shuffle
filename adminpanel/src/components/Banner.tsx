
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Button,
  Input,
  FormLabel,
  Snackbar,
  Alert,
  IconButton,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton
} from "@mui/material";
import {
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
  ImageSearch as ImageSearchIcon
} from "@mui/icons-material";
import { ENDPOINTS } from '../services/endpoints';

interface BannerImage {
  id: number;
  type: string;
  filename: string;
  base64: string;
}

/**
 * Banners live under the admin prefix because admin-service owns the table.
 * READING them is public — every visitor's browser does it before login — and
 * the bytes are in the row now: local disk is not shared between replicas, so
 * the old static-file approach 404'd depending on which instance served the
 * upload. Migration 027 collapsed the pile.
 *
 * Both upload routes were UNAUTHENTICATED in legacy, on a router mounted at
 * `/api/banners`. A casino home page is a payment funnel; replacing its hero
 * image is a phishing page on the operator's own domain.
 */
const BASE_URL = ENDPOINTS.banners.list.replace(/\/$/, '');

const Banner: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [banners, setBanners] = useState<BannerImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBanner, setSelectedBanner] = useState<{
    type: string;
    file: File | null;
    base64Preview?: string;
  } | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>('');

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${BASE_URL}/getAllImagesBinary`);
      if (response.data.status === 'success') {
        setBanners(response.data.images);
        setIsLoading(false);
      } else {
        handleSnackbarOpen('Failed to fetch banners', 'error');
        setIsLoading(false);
      }
    } catch (error) {
      handleSnackbarOpen('Failed to fetch banners', 'error');
      setIsLoading(false);
    }
  };

  const handleSnackbarOpen = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar({ ...snackbar, open: false });
  };

  const handleBannerSelect = (banner: BannerImage) => {
    setSelectedBanner({
      type: banner.type,
      file: null,
      base64Preview: banner.base64
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedBanner(prev => ({
          type: prev?.type || '',
          file: file,
          base64Preview: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const updateBanner = async () => {
    if (!selectedBanner || !selectedBanner.file) {
      handleSnackbarOpen('Please select a banner and an image', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('type', selectedBanner.type);
    formData.append('image', selectedBanner.file);

    try {
      setIsLoading(true);
      await axios.post(`${BASE_URL}/updateBanner`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      handleSnackbarOpen(`Banner ${selectedBanner.type} updated successfully`);
      await fetchBanners();
      setSelectedBanner(null);
    } catch (error) {
      handleSnackbarOpen('Failed to update banner', 'error');
      setIsLoading(false);
    }
  };

  const openPreviewDialog = (base64: string) => {
    setPreviewImage(base64);
    setPreviewDialogOpen(true);
  };

  const renderBannerSkeletons = () => {
    return Array.from(new Array(6)).map((_, index) => (
      <Grid item xs={12} sm={6} md={4} key={index}>
        <Box>
          <Skeleton
            variant="rectangular"
            width="100%"
            height={200}
            sx={{ borderRadius: 2 }}
          />
          <Skeleton width="60%" sx={{ mx: 'auto', mt: 1 }} />
        </Box>
      </Grid>
    ));
  };

  return (
    <div className="p-2">
      <Box
        sx={{
          width: '100%',
          maxWidth: 1000,
          margin: 'auto',
          padding: 2,
          backgroundColor: theme.palette.background.default
        }}
      >
        <Card
          elevation={6}
          sx={{
            borderRadius: 3,
            transition: 'transform 0.3s',
            '&:hover': {
              transform: 'scale(1.01)'
            }
          }}
        >
          <CardHeader
            title="Banner Management"
            titleTypographyProps={{
              variant: 'h4',
              color: 'primary',
              align: 'center'
            }}
            sx={{
              backgroundColor: theme.palette.background.paper,
              borderBottom: `1px solid ${theme.palette.divider}`
            }}
          />
          <CardContent>
            <Grid container spacing={3}>
              {isLoading
                ? renderBannerSkeletons()
                : banners.map(banner => (
                  <Grid item xs={12} sm={6} md={4} key={banner.id}>
                    <Box
                      sx={{
                        border: '2px solid',
                        borderColor: selectedBanner?.type === banner.type
                          ? 'primary.main'
                          : 'grey.300',
                        borderRadius: 2,
                        padding: 1,
                        cursor: 'pointer',
                        backgroundColor: selectedBanner?.type === banner.type
                          ? 'primary.light'
                          : 'transparent',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          boxShadow: theme.shadows[4],
                          transform: 'scale(1.05)'
                        }
                      }}
                    >
                      <Box
                        onClick={() => handleBannerSelect(banner)}
                        sx={{ position: 'relative' }}
                      >
                        <img
                          src={`data:image/png;base64,${banner.base64}`}
                          alt={banner.type}
                          style={{
                            width: '100%',
                            height: 200,
                            objectFit: 'cover',
                            borderRadius: 8
                          }}
                        />
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            openPreviewDialog(banner.base64);
                          }}
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            backgroundColor: 'rgba(255,255,255,0.7)',
                            '&:hover': {
                              backgroundColor: 'rgba(255,255,255,0.9)'
                            }
                          }}
                        >
                          <ImageSearchIcon />
                        </IconButton>
                      </Box>
                    </Box>
                  </Grid>
                )
                )
              }
            </Grid>

            {!isLoading && selectedBanner && (
              <Box sx={{ mt: 4, textAlign: 'center' }}>
                <FormLabel sx={{ display: 'block', mb: 2, fontWeight: 'bold' }}>
                  Selected Banner Type: {selectedBanner.type}
                </FormLabel>
                <Input
                  type="file"
                  inputProps={{
                    accept: '.png,.jpg,.jpeg',
                    style: { display: 'none' }
                  }}
                  onChange={handleFileChange}
                  id="banner-file-input"
                />
                <label htmlFor="banner-file-input">
                  <Button
                    component="span"
                    variant="contained"
                    color="primary"
                    startIcon={<CloudUploadIcon />}
                    sx={{ mb: 2 }}
                  >
                    Choose File
                  </Button>
                </label>

                {selectedBanner.base64Preview && (
                  <Box
                    sx={{
                      mb: 2,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                  >
                    <img
                      src={selectedBanner.base64Preview}
                      alt="Preview"
                      style={{
                        maxWidth: '100%',
                        maxHeight: 300,
                        objectFit: 'contain',
                        borderRadius: 8,
                        boxShadow: theme.shadows[3]
                      }}
                    />
                  </Box>
                )}
                <Button
                  onClick={updateBanner}
                  disabled={!selectedBanner.file || isLoading}
                  variant="contained"
                  color="secondary"
                  fullWidth
                  sx={{
                    mt: 2,
                    py: 1.5,
                    borderRadius: 2
                  }}
                >
                  {isLoading ? 'Updating...' : 'Update Banner'}
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={handleSnackbarClose}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
            action={
              <IconButton
                size="small"
                aria-label="close"
                color="inherit"
                onClick={handleSnackbarClose}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            {snackbar.message}
          </Alert>
        </Snackbar>

        <Dialog
          open={previewDialogOpen}
          onClose={() => setPreviewDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Banner Preview</DialogTitle>
          <DialogContent>
            <img
              src={`data:image/png;base64,${previewImage}`}
              alt="Full Preview"
              style={{
                width: '100%',
                maxHeight: '70vh',
                objectFit: 'contain'
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPreviewDialogOpen(false)} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </div>

  );
};

export default Banner;