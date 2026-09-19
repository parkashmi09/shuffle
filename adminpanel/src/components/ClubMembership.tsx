import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  CardHeader,
  Typography,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Alert,
  IconButton,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { Edit, Delete, Settings, Group, ArrowForward, PersonAdd } from '@mui/icons-material';
import { ENDPOINTS } from '../services/endpoints';

interface Club {
  id: number;
  name: string;
  unique_club_id: string;
  owner_earnings_percentage: number;
  agent_earnings_percentage: number;
  member_earnings_percentage: number;
  profile_picture?: string;
  min_active_players_threshold?: number;
  active_player_wager_threshold?: number;
}

interface Member {
  user_id: number;
  role: string;
  unique_agent_code: string | null;
  user_name: string;
  level: number;
  parent_name: string | null;
  agent_id: number | null;
  parent_user_id: number | null;
  full_hierarchy_path: string[];
}

const ClubMembership: React.FC = () => {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [hierarchy, setHierarchy] = useState<Member[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Dialogs
  const [showAddMemberDialog, setShowAddMemberDialog] = useState<boolean>(false);
  const [showEditClubDialog, setShowEditClubDialog] = useState<boolean>(false);
  const [showConfigDialog, setShowConfigDialog] = useState<boolean>(false);

  // Form States
  const [memberFormData, setMemberFormData] = useState({
    userId: '',
    joinMethod: 'clubId', // or 'agentCode'
    agentCode: '',
    selectedAgentId: '',
  });

  const [clubFormData, setClubFormData] = useState({
    name: '',
    profilePicture: null as File | null,
  });

  const [configFormData, setConfigFormData] = useState({
    ownerEarningsPercentage: 0,
    agentEarningsPercentage: 0,
    memberEarningsPercentage: 0,
    activePlayerThreshold: 0,
    activePlayerWagerThreshold: 0,
  });

  /**
   * Every club route was erroring in production: the controllers query
   * `club_memberships`, which did not exist until migration 014.
   */
  const baseUrl = ENDPOINTS.clubs.list.replace(/\/$/, '');

  // Fetch Functions
  const fetchClubs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${baseUrl}/clubs/fetch`);
      if (!response.ok) throw new Error('Failed to fetch clubs');
      const data = await response.json();
      setClubs(data.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch clubs');
      console.error('Error fetching clubs:', err);
    } finally {
      setLoading(false);
    }
  };
  // Add a new function to sort hierarchy

  const sortHierarchy = (members: Member[]): Member[] => {
    const rolePriority = {
      owner: 1,
      agent: 2,
      member: 3
    };

    return [...members].sort((a, b) => {
      if (a.level !== b.level) {
        return a.level - b.level;
      }

      const roleA = rolePriority[a.role as keyof typeof rolePriority];
      const roleB = rolePriority[b.role as keyof typeof rolePriority];
      if (roleA !== roleB) {
        return roleA - roleB;
      }

      const pathA = a.full_hierarchy_path.join('-');
      const pathB = b.full_hierarchy_path.join('-');
      return pathA.localeCompare(pathB);
    });
  };

  const fetchHierarchy = async (clubId: number) => {
    try {
      const response = await fetch(`${baseUrl}/${clubId}/hierarchy`);
      if (!response.ok) throw new Error('Failed to fetch hierarchy');
      const data = await response.json();
      setHierarchy(sortHierarchy(data.hierarchy));
      setError('');
    } catch (err) {
      setError('Failed to fetch hierarchy');
      console.error('Error fetching hierarchy:', err);
    }
  };
  // Handle Club Operations
  const handleEditClub = async () => {
    if (!selectedClub) return;

    const formData = new FormData();
    formData.append('clubId', selectedClub.id.toString());
    formData.append('clubName', clubFormData.name);
    if (clubFormData.profilePicture) {
      formData.append('profilePicture', clubFormData.profilePicture);
    }
    try {
      const response = await fetch(`${baseUrl}/update`, {
        method: 'PUT',
        body: formData,
      });
      if (response.ok) {
        await fetchClubs();
        await fetchHierarchy(selectedClub.id);
        setShowEditClubDialog(false);
        setError('');
      }
    } catch (err) {
      setError('Failed to update club');
    }
  };

  const handleUpdateConfig = async () => {
    if (!selectedClub) return;

    try {
      const response = await fetch(`${baseUrl}/earnings-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId: selectedClub.id,
          ...configFormData,
        }),
      });
      if (response.ok) {
        await fetchClubs();
        await fetchHierarchy(selectedClub.id);
        setShowConfigDialog(false);
        setError('');
      }
    } catch (err) {
      setError('Failed to update configuration');
    }
  };

  const handleDeleteClub = async (clubId: number) => {
    if (!window.confirm('Are you sure you want to delete this club?')) return;
    try {
      const response = await fetch(`${baseUrl}/${clubId}/delete`, { method: 'DELETE' });
      if (response.ok) {
        await fetchClubs();
        setError('');
        setHierarchy([]);
        setSelectedClub(null);
      }
    } catch (err) {
      setError('Failed to delete club');
    }
  };


  // Handle Member Operations
  // Update all API handling functions to refetch hierarchy
  const handleAddMember = async () => {
    if (!selectedClub) return;

    try {
      const payload = memberFormData.joinMethod === 'clubId'
        ? {
          userId: memberFormData.userId,
          clubId: selectedClub.unique_club_id,
        }
        : {
          userId: memberFormData.userId,
          agentCode: memberFormData.agentCode,
        };

      const response = await fetch(`${baseUrl}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowAddMemberDialog(false);
        setMemberFormData({
          userId: '',
          joinMethod: 'clubId',
          agentCode: '',
          selectedAgentId: '',
        });
        await fetchClubs();
        await fetchHierarchy(selectedClub.id);
        setError('');
      }
    } catch (err) {
      setError('Failed to add member');
    }
  };

  const handleChangeRole = async (userId: number, newRole: string) => {
    if (!selectedClub) return;
    try {
      const response = await fetch(`${baseUrl}/change-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, clubId: selectedClub.id, newRole }),
      });
      if (response.ok) {
        await fetchClubs();
        await fetchHierarchy(selectedClub.id);
        setError('');
      }
    } catch (err) {
      setError('Failed to change role');
    }
  };
  useEffect(() => {
    const fetchData = async () => {
      await fetchClubs();
      if (selectedClub) {
        await fetchHierarchy(selectedClub.id);
      }
    };

    // Initial fetch
    fetchData();
  }, [selectedClub?.id]);

  return (
    <div className="p-2">
      <Grid container spacing={3}>
        {/* Clubs List */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Clubs" />
            <CardContent>
              {loading ? (
                <CircularProgress />
              ) : (
                clubs.map((club) => (
                  <Card
                    key={club.id}
                    variant="outlined"
                    style={{
                      marginBottom: '8px',
                      padding: '16px',
                      cursor: 'pointer',
                      backgroundColor: selectedClub?.id === club.id ? '#e0f7fa' : undefined,
                    }}
                    onClick={() => {
                      setSelectedClub(club);
                      fetchHierarchy(club.id);
                    }}
                  >
                    <Typography variant="h6">{club.name}</Typography>
                    <Typography variant="body2">ID: {club.unique_club_id}</Typography>
                    <CardActions>
                      <Button
                        startIcon={<Edit />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setClubFormData({ name: club.name, profilePicture: null });
                          setShowEditClubDialog(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        startIcon={<Delete />}
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClub(club.id);
                        }}
                      >
                        Delete
                      </Button>
                    </CardActions>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Club Details */}
        <Grid item xs={12} md={8}>
          <Card>
            {selectedClub ? (
              <>
                <CardHeader
                  title={selectedClub.name}
                  subheader={`ID: ${selectedClub.unique_club_id}`}
                  action={
                    <>
                      <Button
                        startIcon={<Settings />}
                        variant="outlined"
                        onClick={() => {
                          setConfigFormData({
                            ownerEarningsPercentage: selectedClub.owner_earnings_percentage,
                            agentEarningsPercentage: selectedClub.agent_earnings_percentage,
                            memberEarningsPercentage: selectedClub.member_earnings_percentage,
                            activePlayerThreshold: selectedClub.min_active_players_threshold || 0,
                            activePlayerWagerThreshold: selectedClub.active_player_wager_threshold || 0,
                          });
                          setShowConfigDialog(true);
                        }}
                      >
                        Edit Config
                      </Button>
                      <Button
                        startIcon={<PersonAdd />}
                        variant="contained"
                        onClick={() => setShowAddMemberDialog(true)}
                        style={{ marginLeft: '8px' }}
                      >
                        Add Member
                      </Button>
                    </>
                  }
                />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <Typography>
                        <strong>Owner Earnings:</strong> {selectedClub.owner_earnings_percentage}%
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography>
                        <strong>Agent Earnings:</strong> {selectedClub.agent_earnings_percentage}%
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography>
                        <strong>Member Earnings:</strong> {selectedClub.member_earnings_percentage}%
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
                <CardContent>
                  <Typography variant="h6">Hierarchy</Typography>
                  {hierarchy.map((member) => (
                    <div
                      key={member.user_id}
                      style={{
                        marginLeft: `${member.level * 24}px`,
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: '#f5f5f5',
                        marginBottom: '8px',
                        borderLeft: '2px solid #2196f3',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {member.level > 0 && <ArrowForward style={{ color: '#2196f3' }} />}
                        <div style={{ marginLeft: '8px' }}>
                          <Typography>{member.user_name}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {member.role.toUpperCase()}
                            {member.unique_agent_code && ` • Agent Code: ${member.unique_agent_code}`}
                            {member.parent_name && ` • Under: ${member.parent_name}`}
                          </Typography>
                        </div>
                      </div>
                      {member.role !== 'owner' && member.role !== 'agent' && (
                        <TextField
                          select
                          size="small"
                          value={member.role}
                          onChange={(e) => handleChangeRole(member.user_id, e.target.value)}
                        >
                          <MenuItem value="member">Member</MenuItem>
                          <MenuItem value="agent">Agent</MenuItem>
                        </TextField>
                      )}
                      {member.role === 'agent' && (
                        <Typography variant="caption" color="textSecondary" style={{ marginRight: '14px' }}>
                          Agent role cannot be changed
                        </Typography>
                      )}
                    </div>
                  ))}
                </CardContent>
              </>
            ) : (
              <CardContent style={{ textAlign: 'center', padding: '40px' }}>
                <Group style={{ fontSize: '48px', color: '#bdbdbd' }} />
                <Typography variant="body1" color="textSecondary">
                  Select a club to view details
                </Typography>
              </CardContent>
            )}
          </Card>
        </Grid>
      </Grid>

      {error && <Alert severity="error" style={{ marginTop: '16px' }}>{error}</Alert>}

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberDialog} onClose={() => setShowAddMemberDialog(false)}>
        <DialogTitle>Add Member</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="User ID"
            type="number"
            value={memberFormData.userId}
            onChange={(e) => setMemberFormData({ ...memberFormData, userId: e.target.value })}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Join Method</InputLabel>
            <Select
              value={memberFormData.joinMethod}
              onChange={(e) => setMemberFormData({
                ...memberFormData,
                joinMethod: e.target.value as string,
                agentCode: '',
                selectedAgentId: ''
              })}
            >
              <MenuItem value="clubId">Direct Club Join</MenuItem>
              <MenuItem value="agentCode">Via Agent Code</MenuItem>
            </Select>
          </FormControl>

          {memberFormData.joinMethod === 'agentCode' && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Select Agent</InputLabel>
              <Select
                value={memberFormData.selectedAgentId}
                onChange={(e) => {
                  const agent = hierarchy.find(m => m.user_id.toString() === e.target.value);
                  setMemberFormData({
                    ...memberFormData,
                    selectedAgentId: e.target.value as string,
                    agentCode: agent?.unique_agent_code || ''
                  });
                }}
              >
                {hierarchy
                  .filter(member => member.role === 'agent')
                  .map(agent => (
                    <MenuItem key={agent.user_id} value={agent.user_id}>
                      {agent.user_name} ({agent.unique_agent_code})
                    </MenuItem>
                  ))
                }
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddMemberDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddMember}>Add</Button>
        </DialogActions>
      </Dialog>
      {/* Edit Club Dialog */}
      <Dialog open={showEditClubDialog} onClose={() => setShowEditClubDialog(false)}>
        <DialogTitle>Edit Club</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Club Name"
            value={clubFormData.name}
            onChange={(e) => setClubFormData({ ...clubFormData, name: e.target.value })}
            margin="normal"
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setClubFormData({ ...clubFormData, profilePicture: file });
              }
            }}
            style={{ marginTop: '16px' }}
          />
          {selectedClub?.profile_picture && (
            <Typography variant="caption" display="block" style={{ marginTop: '8px' }}>
              Current profile picture: {selectedClub.profile_picture}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditClubDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditClub}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Config Dialog */}
      <Dialog open={showConfigDialog} onClose={() => setShowConfigDialog(false)}>
        <DialogTitle>Edit Club Configuration</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Owner Earnings Percentage"
                type="number"
                value={configFormData.ownerEarningsPercentage}
                onChange={(e) => setConfigFormData({
                  ...configFormData,
                  ownerEarningsPercentage: Number(e.target.value)
                })}
                margin="normal"
                inputProps={{ min: 0, max: 100 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Agent Earnings Percentage"
                type="number"
                value={configFormData.agentEarningsPercentage}
                onChange={(e) => setConfigFormData({
                  ...configFormData,
                  agentEarningsPercentage: Number(e.target.value)
                })}
                margin="normal"
                inputProps={{ min: 0, max: 100 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Member Earnings Percentage"
                type="number"
                value={configFormData.memberEarningsPercentage}
                onChange={(e) => setConfigFormData({
                  ...configFormData,
                  memberEarningsPercentage: Number(e.target.value)
                })}
                margin="normal"
                inputProps={{ min: 0, max: 100 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Minimum Active Players Threshold"
                type="number"
                value={configFormData.activePlayerThreshold}
                onChange={(e) => setConfigFormData({
                  ...configFormData,
                  activePlayerThreshold: Number(e.target.value)
                })}
                margin="normal"
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Active Player Wager Threshold"
                type="number"
                value={configFormData.activePlayerWagerThreshold}
                onChange={(e) => setConfigFormData({
                  ...configFormData,
                  activePlayerWagerThreshold: Number(e.target.value)
                })}
                margin="normal"
                inputProps={{ min: 0 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfigDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateConfig}>Save Configuration</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ClubMembership;
