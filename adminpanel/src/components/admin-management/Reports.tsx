import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import { Search, ChevronLeft, ChevronRight, Star, Download, AlertCircle, Loader } from 'lucide-react';
import { ENDPOINTS } from '../../services/endpoints';

/**
 * THE WHOLE LEGACY `/reports` ROUTER WAS UNAUTHENTICATED, on three routes that
 * read the customer database — and the CSV export returned every direct player
 * (id, name, referral code, balance) to anyone who asked, escaping quotes but
 * not the `=`/`+`/`-`/`@` that make a spreadsheet cell a formula.
 */
const BASE_URL = ENDPOINTS.reports.players.replace(/\/players$/, '');

// Define TypeScript interfaces
interface User {
  id: string;
  name: string;
  avatar?: string;
  wager: string | number;
  games_played: number;
  vipDetails?: {
    vipLevel: string;
    previousVipLevel: string;
    currentWager: string;
    wagerNeededForNextLevel: string;
    completionPercentage: string;
    card: string;
  };
  level?: number;
  referalcode?: string;
}

interface UserDetails {
  user?: User;
  vipDetails?: {
    vipLevel: string;
    previousVipLevel: string;
    currentWager: string;
    wagerNeededForNextLevel: number;
    completionPercentage: number;
    card: string;
  };
  wager: string | number;
  credits?: Record<string, string | number>;
}

interface ApiResponse {
  users: User[];
  pagination: {
    pages: number;
    current: number;
    total: number;
  };
}

const Reports: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [userDetailsLoading, setUserDetailsLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchTerm]);

  const fetchUsers = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await axios.get<ApiResponse>(`${BASE_URL}/users`, {
        params: {
          page: currentPage,
          limit: 10,
          search: searchTerm
        }
      });
      setUsers(response.data.users);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewUserDetails = async (userId: string): Promise<void> => {
    setUserDetailsLoading(true);
    try {
      const response = await axios.get<UserDetails>(`${BASE_URL}/user/${userId}`);
      setSelectedUser(response.data);
    } catch (error) {
      console.error('Error fetching user details:', error);
    } finally {
      setUserDetailsLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when search changes
  };

  const handlePageChange = (page: number): void => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const exportReports = async (): Promise<void> => {
    try {
      // Get current date for filename
      const date = new Date().toISOString().split('T')[0];
      const filename = `user_reports_${date}.csv`;

      // Show loading indicator
      setLoading(true);

      // Make API call to get export data
      const response = await axios.get(`${BASE_URL}/export`, {
        params: { search: searchTerm },
        responseType: 'blob' // Important for handling file downloads
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);

      // Append link, trigger click, and clean up
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting reports:', error);
      alert('Failed to export reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get card color based on VIP level
  const getCardColor = (level?: string): string => {
    // Extract level number if it's in format "VIP XX"
    const levelNum = typeof level === 'string' && level.includes('VIP')
      ? parseInt(level.replace('VIP', '').trim())
      : parseInt(level || '0') || 0;

    if (levelNum >= 50) return '#E5E4E2'; // platinum
    if (levelNum >= 30) return '#FFD700'; // gold
    if (levelNum >= 10) return '#C0C0C0'; // silver
    return '#CD7F32'; // bronze
  };

  const getVipCardType = (level?: string): string => {
    // Extract level number if it's in format "VIP XX"
    const levelNum = typeof level === 'string' && level.includes('VIP')
      ? parseInt(level.replace('VIP', '').trim())
      : parseInt(level || '0') || 0;

    if (levelNum >= 50) return 'platinum';
    if (levelNum >= 30) return 'gold';
    if (levelNum >= 10) return 'silver';
    return 'bronze';
  };

  return (
    <div className="p-2">
      <Container>
        <Header>
          <Title>User Reports</Title>
          <ActionButtons>
            <ExportButton onClick={exportReports}>
              <Download size={18} />
              Export Reports
            </ExportButton>
          </ActionButtons>
        </Header>

        <SearchBar>
          <SearchIconWrapper>
            <Search size={16} color="#8A8D93" />
          </SearchIconWrapper>
          <SearchInput
            placeholder="Search by username or referral code..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </SearchBar>

        {loading ? (
          <LoadingContainer>
            <Loader size={32} color="#5D81AC" className="animate-spin" />
            <LoadingText>Loading user data...</LoadingText>
          </LoadingContainer>
        ) : users.length === 0 ? (
          <NoResultsContainer>
            <AlertCircle size={48} color="#5D81AC" />
            <p>No users found matching your search criteria</p>
          </NoResultsContainer>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>User</TableHeader>
                    <TableHeader>Wager (USD)</TableHeader>
                    <TableHeader>VIP Level</TableHeader>

                    <TableHeader>Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <UserInfo>

                          <UserName>{user.name}</UserName>
                        </UserInfo>
                      </TableCell>
                      <TableCell>{parseFloat(user.wager.toString()).toFixed(2)}</TableCell>
                      <TableCell>
                        <VipLevelBadge cardColor={getCardColor(user.vipDetails?.previousVipLevel)}>
                          <Star size={14} />
                          {user.vipDetails?.previousVipLevel || 'VIP 00'}
                        </VipLevelBadge>
                      </TableCell>

                      <TableCell>
                        <ViewButton onClick={() => handleViewUserDetails(user.id)}>View Details</ViewButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Pagination>
              <PaginationButton
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
                Previous
              </PaginationButton>
              <PageInfo>
                Page {currentPage} of {totalPages}
              </PageInfo>
              <PaginationButton
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight size={16} />
              </PaginationButton>
            </Pagination>
          </>
        )}

        {selectedUser && (
          <UserDetailModal>
            <Overlay onClick={() => setSelectedUser(null)} />
            <Modal>
              {userDetailsLoading ? (
                <LoadingContainer>
                  <Loader size={32} color="#5D81AC" className="animate-spin" />
                  <LoadingText>Loading user details...</LoadingText>
                </LoadingContainer>
              ) : (
                <VIPContainer>
                  <CloseButton onClick={() => setSelectedUser(null)}>×</CloseButton>
                  <TopCardContainer>
                    <VIPContentContainer>
                      <VIPInfo>
                        <VIPTitle>
                          {selectedUser.vipDetails?.previousVipLevel || 'VIP 0'}
                        </VIPTitle>
                        <XPText>
                          Current Wager: <span>{parseFloat(selectedUser.wager.toString() || '0').toFixed(2)}</span> USD
                        </XPText>
                        <ProgressBar>
                          <Progress progress={selectedUser.vipDetails?.completionPercentage || 0} />
                        </ProgressBar>

                      </VIPInfo>
                    </VIPContentContainer>
                    <VIPImage
                      cardType={getVipCardType(selectedUser.vipDetails?.vipLevel)}
                    />
                  </TopCardContainer>

                  <UserDetailsGrid>
                    <DetailCard>
                      <DetailCardTitle>User Information</DetailCardTitle>
                      <DetailItem>
                        <DetailLabel>Username:</DetailLabel>
                        <DetailValue>{selectedUser.user?.name}</DetailValue>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabel>User ID:</DetailLabel>
                        <DetailValue>{selectedUser.user?.id}</DetailValue>
                      </DetailItem>
                      <DetailItem>
                        <DetailLabel>Referral Code:</DetailLabel>
                        <DetailValue>{selectedUser.user?.referalcode || 'N/A'}</DetailValue>
                      </DetailItem>
                    </DetailCard>

                    <DetailCard>
                      <DetailCardTitle>Balance Information</DetailCardTitle>
                      {selectedUser.credits && Object.entries(selectedUser.credits).map(([key, value]) => {
                        // Skip the uid field
                        if (key === 'uid') return null;

                        return (
                          <DetailItem key={key}>
                            <DetailLabel>{key.toUpperCase()}:</DetailLabel>
                            <DetailValue>{parseFloat(value.toString() || '0').toFixed(8)}</DetailValue>
                          </DetailItem>
                        );
                      })}
                    </DetailCard>
                  </UserDetailsGrid>
                </VIPContainer>
              )}
            </Modal>
          </UserDetailModal>
        )}
      </Container>
    </div>

  );
};

// Styled components with TypeScript props
const Container = styled.div`
  padding: 24px;
  background-color: #232626;
  color: #fff;
  min-height: 100vh;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: #ffffff;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 12px;
`;

const ExportButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: #5D81AC;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #4A6889;
  }
`;

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  background-color: #2A2D36;
  border-radius: 8px;
  padding: 0 12px;
  margin-bottom: 24px;
  border: 1px solid #3A3D46;
`;

const SearchIconWrapper = styled.div`
  margin-right: 8px;
`;

const SearchInput = styled.input`
  flex: 1;
  background: none;
  border: none;
  color: #fff;
  padding: 12px 0;
  font-size: 14px;
  outline: none;
  
  &::placeholder {
    color: #8A8D93;
  }
`;

const TableContainer = styled.div`
  overflow-x: auto;
  background-color: #2A2D36;
  border-radius: 8px;
  margin-bottom: 24px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const TableHead = styled.thead`
  background-color: #323738;
`;

const TableBody = styled.tbody``;

const TableRow = styled.tr`
  &:not(:last-child) {
    border-bottom: 1px solid #3A3D46;
  }
  
  &:hover {
    background-color: #323738;
  }
`;

const TableHeader = styled.th`
  text-align: left;
  padding: 16px;
  font-weight: 500;
  color: #8A8D93;
  font-size: 14px;
`;

const TableCell = styled.td`
  padding: 16px;
  font-size: 14px;
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
`;

const UserAvatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  margin-right: 12px;
  object-fit: cover;
  background-color: #3A3D46;
`;

const UserName = styled.span`
  font-weight: 500;
`;

interface VipLevelBadgeProps {
  cardColor?: string;
}

const VipLevelBadge = styled.div<VipLevelBadgeProps>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background-color: ${props => props.cardColor || '#CD7F32'};
  color: #000;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

const ViewButton = styled.button`
  background-color: #5D81AC;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #4A6889;
  }
`;

const Pagination = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
`;

const PaginationButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: #323738;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #3A3D46;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PageInfo = styled.div`
  font-size: 14px;
  color: #8A8D93;
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 300px;
  gap: 16px;
`;

const LoadingText = styled.p`
  font-size: 16px;
  color: #8A8D93;
`;

const NoResultsContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 300px;
  font-size: 16px;
  color: #8A8D93;
  gap: 16px;
`;

// Modal styled components
const UserDetailModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;

  @media (max-width: 768px) {
    background-color: rgb(35 38 38);
    align-items: flex-start;
  }
`;

const Modal = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 12px;
  width: 50%;
  max-width: 544px;
  color: white;
  max-height: 80vh;
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 1001;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);

  @media (max-width: 768px) {
    width: 100%;
    height: 100vh;
    max-width: none;
    max-height: none;
    top: 0;
    left: 0;
    transform: none;
    border-radius: 0;
    position: relative;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }
`;

const VIPContainer = styled.div`
  background: linear-gradient(20deg, rgba(93, 129, 172, 0) 52.52%, #5D81AC 80.76%);
  padding: 24px 20px;
  background-color: rgb(35 38 38);
  background-image: linear-gradient(20deg, rgba(93, 129, 172, 0) 52.52%, #5D81AC 110.76%);
  position: relative;
  border-radius: 12px;

  @media (max-width: 768px) {
    min-height: 100vh;
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    border-radius: 0;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.3);
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  z-index: 10;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(0, 0, 0, 0.5);
  }
`;

const TopCardContainer = styled.div`
  background-image: linear-gradient(11deg, #32373800 51%, #5d81ac 106.98%);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  position: relative;
  min-height: 100px;
  display: flex;
  justify-content: space-between;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  border-bottom: 15px solid #323738;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(93, 129, 172, 0.1) 0%, rgba(35, 38, 38, 0.8) 100%);
    z-index: 0;
  }
`;

const VIPContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
  max-width: 70%;
  position: relative;
  z-index: 1;
`;

interface VIPImageProps {
  cardType: string;
}

const VIPImage = styled.div<VIPImageProps>`
  width: 140px;
  height: 140px;
  background-image: url(${props => {
    switch (props.cardType) {
      case 'platinum': return '/assets/images/bcgames/awards/vip-platinum.png';
      case 'gold': return '/assets/images/bcgames/awards/vip-gold.png';
      case 'silver': return '/assets/images/bcgames/awards/vip-silver.png';
      default: return '/assets/images/bcgames/awards/vip-bronze.png';
    }
  }});
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  align-self: center;
  position: relative;
  z-index: 1;
`;

const VIPInfo = styled.div`
  position: relative;
  z-index: 1;
`;

const VIPTitle = styled.h2`
  font-size: 28px;
  margin-bottom: 12px;
  color: #fff;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const XPText = styled.p`
  font-size: 16px;
  color: #aaaaaa;
  margin: 8px 0;
  
  span {
    color: white;
    font-weight: 500;
  }
`;

const ProgressBar = styled.div`
  background: rgba(30, 33, 40, 0.8);
  height: 10px;
  border-radius: 5px;
  margin: 12px 0;
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
`;

interface ProgressProps {
  progress: number;
}

const Progress = styled.div<ProgressProps>`
  background: linear-gradient(90deg, #4CAF50, #8BC34A);
  height: 100%;
  border-radius: 5px;
  width: ${props => props.progress}%;
  transition: width 0.3s ease;
`;

const UserDetailsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const DetailCard = styled.div`
  background-color: #2A2D36;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const DetailCardTitle = styled.h3`
  font-size: 18px;
  margin-bottom: 16px;
  color: #fff;
  font-weight: 600;
  position: relative;
  padding-bottom: 12px;
  
  &:after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 40px;
    height: 3px;
    background-color: #5D81AC;
    border-radius: 2px;
  }
`;

const DetailItem = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #3A3D46;
  
  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
`;

const DetailLabel = styled.span`
  color: #8A8D93;
  font-size: 14px;
`;

const DetailValue = styled.span`
  color: #fff;
  font-size: 14px;
  font-weight: 500;
`;

export default Reports;