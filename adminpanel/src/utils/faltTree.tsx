export interface FlatUser{ id:number;name:string;email:string;
                           parent_staff_id:number|null; }
export interface TreeUser extends FlatUser{ children:TreeUser[] }

export function flatToTree(list:FlatUser[]):TreeUser[]{
  const buckets=new Map<number|null,TreeUser[]>([[null,[]]]);
  list.forEach(u=>buckets.set(u.id,[]));
  const byId=new Map<number,TreeUser>();
  list.forEach(u=>byId.set(u.id,{...u,children:buckets.get(u.id)!}));
  list.forEach(u=>{
    (buckets.get(u.parent_staff_id)||buckets.get(null)!).push(byId.get(u.id)!);
  });
  return buckets.get(null)!;
}
