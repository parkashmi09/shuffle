// shuffle: the part of hash's services/sportsStatement.js the exchange statement uses (direct vs agent).
import { request } from './client';


/** true = came through an agent, false = signed up on the site, null = cannot tell. */
export function isAgentTreePlayer(me) {
  if (!me || typeof me !== 'object') return null;
  if (typeof me.agentTree === 'boolean') return me.agentTree;
  const caps = me.capabilities;
  if (!caps || typeof caps !== 'object') return null;
  return caps.vault === false && caps.swap === false && caps.tips === false;
}

export async function getStatementKind() {
  const me = await request('/user/auth/me');
  const agent = isAgentTreePlayer(me);
  return agent === null ? null : agent ? 'agent' : 'direct';
}
