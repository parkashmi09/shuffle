'use client'

// React Imports
import { type ComponentType } from 'react'

import { useCallback, useMemo, useState } from 'react'

// Next Imports
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

// Third-party Imports
import * as Icon from 'lucide-react'
import { ChevronRightIcon, SquareArrowOutUpRightIcon } from 'lucide-react'

// Type Imports
import type { MenuGroupSubItem, MenuItem, MenuLeafSubItem, MenuSubItem, NavItem } from '@/configs/navConfig'

// Component Imports
import LogoSvg from '@/assets/svg/logo'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar
} from '@/components/ui/sidebar'

// Config Imports
import { navItems } from '@/configs/navConfig'
import themeConfig from '@/configs/themeConfig'
import { siteConfig } from '@/configs/site'
import { useSession } from '@/contexts/SessionContext'

// Util Imports
import { cn } from '@/lib/utils'

const isSubGroup = (item: MenuSubItem): item is MenuGroupSubItem => 'childItems' in item

// ── Shell styling ────────────────────────────────────────────────────────────
// One accent (primary) marks the current page and nothing else. Everything at rest
// is ink on paper: muted icons, muted labels, no fills.

// A top-level row: comfortable height, muted 16px icon, accent only when current.
const menuRowClass =
  'relative h-9 rounded-md px-2 [&_svg]:size-4 [&_svg]:text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'

// The current page: accent wash, accent ink, accent icon, and a 2px left marker.
const menuRowActiveClass =
  'data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground data-active:[&_svg]:text-primary data-active:before:bg-primary data-active:before:absolute data-active:before:inset-y-1.5 data-active:before:left-0 data-active:before:w-0.5 data-active:before:rounded-r-full'

// A branch that merely *contains* the current page stays flat — only its ink shifts,
// so exactly one row in the tree ever reads as "here".
const menuRowBranchClass = 'data-active:bg-transparent! data-active:text-sidebar-accent-foreground'

// Sub-rows sit inside the guide rail, so they take the wash without the marker.
const subRowClass =
  'h-8 justify-between rounded-md data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground data-active:font-medium'

const subBranchClass =
  'h-8 justify-between rounded-md data-active:bg-transparent! data-active:text-sidebar-accent-foreground data-active:font-medium'

// Counts are information, not decoration.
// top-2! re-centres the badge against the taller 36px row.
const badgeClass = 'bg-muted top-2! max-w-24 truncate rounded-full px-1.5 font-normal tabular-nums'

const isExternalLink = (href: string) => href.startsWith('http://') || href.startsWith('https://')

// Key used to track the open state of a nested sub-group, namespaced by its parent
// so two sub-groups sharing a label in different parents never collide.
const subGroupKey = (itemLabel: string, subItemLabel: string) => `${itemLabel}::${subItemLabel}`

function isLinkActive(
  href: string,
  activePath: string | undefined,
  pathname: string,
  searchParams: Pick<URLSearchParams, 'get'>
): boolean {
  if (activePath) {
    return pathname.startsWith(activePath)
  }

  if (href.includes('?')) {
    const [hrefPath, hrefQuery] = href.split('?')

    if (pathname !== hrefPath) return false

    const hrefParams = new URLSearchParams(hrefQuery)

    for (const [key, value] of hrefParams.entries()) {
      if (searchParams.get(key) !== value) return false
    }

    return true
  }

  return pathname === href
}

// Keys of every branch (top-level item, plus nested sub-group) that contains the active
// route. Branches the user has never toggled fall back to this, so the tree opens itself
// on first render and follows the route on every navigation.
function getActiveBranchKeys(
  groups: NavItem[],
  pathname: string,
  searchParams: Pick<URLSearchParams, 'get'>
): Set<string> {
  const keys = new Set<string>()

  groups.forEach(group => {
    group.items.forEach(item => {
      item.childItems?.forEach(subItem => {
        if (isSubGroup(subItem)) {
          if (subItem.childItems.some(leaf => isLinkActive(leaf.href, leaf.activePath, pathname, searchParams))) {
            keys.add(item.label)
            keys.add(subGroupKey(item.label, subItem.label))
          }
        } else if (isLinkActive(subItem.href, subItem.activePath, pathname, searchParams)) {
          keys.add(item.label)
        }
      })
    })
  })

  return keys
}

// A single navigable link inside the icon-mode flyout, at either nesting level.
const FlyoutMenuLink = ({ item, isActive }: { item: MenuLeafSubItem; isActive: boolean }) => (
  <DropdownMenuItem
    className={cn('justify-between gap-2', isActive && 'bg-accent text-accent-foreground font-medium')}
    render={<Link href={item.href} target={item.target} />}
  >
    <span className='truncate'>{item.label}</span>
    <div className='flex items-center gap-2'>
      {item.badge && (
        <span className={cn('bg-muted ml-auto rounded-full px-1.5 text-xs font-normal', item.badgeClassName)}>
          {item.badge}
        </span>
      )}
      {isExternalLink(item.href) && <SquareArrowOutUpRightIcon className='ml-auto size-3.5 shrink-0 opacity-50' />}
    </div>
  </DropdownMenuItem>
)

// Icon-mode stand-in for a collapsible menu item. The rail is too narrow to show the
// inline sub-menu, so the children open in a dropdown to the right of the rail — with
// nested sub-groups rendered as submenus so every leaf stays reachable.
const FlyoutMenuItem = ({
  item,
  childItems,
  isChildActive,
  pathname,
  searchParams
}: {
  item: MenuItem
  childItems: MenuSubItem[]
  isChildActive: boolean
  pathname: string
  searchParams: Pick<URLSearchParams, 'get'>
}) => {
  const Tag = item.icon ? (Icon[item.icon] as ComponentType) : null

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<SidebarMenuButton isActive={isChildActive} className={cn(menuRowClass, menuRowActiveClass)} />}
        >
          {Tag && <Tag />}
          <span className='min-w-0 flex-1 truncate'>{item.label}</span>
          <ChevronRightIcon className='ml-auto' />
        </DropdownMenuTrigger>
        <DropdownMenuContent side='right' align='start' sideOffset={12} className='w-auto min-w-52'>
          {/* The label must live inside a Group — Base UI's GroupLabel throws without one. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className='text-foreground flex items-center gap-2 text-sm'>
              <span className='truncate'>{item.label}</span>
              {item.badge && (
                <span className={cn('bg-muted rounded-full px-1.5 text-xs font-normal', item.badgeClassName)}>
                  {item.badge}
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {childItems.map(subItem =>
              isSubGroup(subItem) ? (
                <DropdownMenuSub key={subItem.label}>
                  <DropdownMenuSubTrigger
                    className={cn(
                      subItem.childItems.some(leaf =>
                        isLinkActive(leaf.href, leaf.activePath, pathname, searchParams)
                      ) && 'bg-accent text-accent-foreground font-medium'
                    )}
                  >
                    <span className='truncate'>{subItem.label}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent sideOffset={9} className='w-auto min-w-48'>
                    {subItem.childItems.map(leaf => (
                      <FlyoutMenuLink
                        key={leaf.label}
                        item={leaf}
                        isActive={isLinkActive(leaf.href, leaf.activePath, pathname, searchParams)}
                      />
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : (
                <FlyoutMenuLink
                  key={subItem.label}
                  item={subItem}
                  isActive={isLinkActive(subItem.href, subItem.activePath, pathname, searchParams)}
                />
              )
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

const SidebarGroupedMenuItems = ({
  data,
  groupLabel,
  pathname,
  searchParams,
  isIconMode,
  isBranchOpen,
  setOpenItem
}: {
  data: MenuItem[]
  groupLabel?: string
  pathname: string
  searchParams: Pick<URLSearchParams, 'get'>
  isIconMode: boolean
  isBranchOpen: (key: string) => boolean
  setOpenItem: (key: string, open: boolean) => void
}) => {
  return (
    <SidebarGroup className='gap-1 px-2 py-1.5'>
      {groupLabel && (
        <SidebarGroupLabel className='text-sidebar-foreground/55 px-2 text-[11px] font-semibold tracking-[0.09em] uppercase'>
          {groupLabel}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {data.map(item => {
            const Tag = item.icon ? (Icon[item.icon] as ComponentType) : null

            const isChildActive =
              item.childItems?.some(subItem =>
                isSubGroup(subItem)
                  ? subItem.childItems.some(leaf => isLinkActive(leaf.href, leaf.activePath, pathname, searchParams))
                  : isLinkActive(subItem.href, subItem.activePath, pathname, searchParams)
              ) ?? false

            if (item.childItems && isIconMode) {
              return (
                <FlyoutMenuItem
                  key={item.label}
                  item={item}
                  childItems={item.childItems}
                  isChildActive={isChildActive}
                  pathname={pathname}
                  searchParams={searchParams}
                />
              )
            }

            return item.childItems ? (
              <Collapsible
                className='group/collapsible'
                key={item.label}
                open={isBranchOpen(item.label)}
                onOpenChange={open => setOpenItem(item.label, open)}
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger
                    render={
                      <SidebarMenuButton
                        tooltip={item.label}
                        isActive={isChildActive}
                        className={cn(menuRowClass, menuRowBranchClass)}
                      />
                    }
                  >
                    {Tag && <Tag />}
                    <span className={cn('min-w-0 flex-1 truncate', item.badge && 'pr-14')}>{item.label}</span>
                    {item.badge && (
                      <SidebarMenuBadge className={cn(badgeClass, item.badgeClassName)}>{item.badge}</SidebarMenuBadge>
                    )}
                    <ChevronRightIcon className='ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90' />
                  </CollapsibleTrigger>
                  <CollapsibleContent className='h-(--collapsible-panel-height) overflow-hidden transition-all duration-200 data-ending-style:h-0 data-starting-style:h-0'>
                    <SidebarMenuSub>
                      {item.childItems.map(subItem =>
                        isSubGroup(subItem) ? (
                          <Collapsible
                            className='group/subcollapsible'
                            key={subItem.label}
                            open={isBranchOpen(subGroupKey(item.label, subItem.label))}
                            onOpenChange={open => setOpenItem(subGroupKey(item.label, subItem.label), open)}
                          >
                            <SidebarMenuSubItem>
                              <CollapsibleTrigger
                                nativeButton={false}
                                render={
                                  <SidebarMenuSubButton
                                    className={subBranchClass}
                                    isActive={subItem.childItems.some(leaf =>
                                      isLinkActive(leaf.href, leaf.activePath, pathname, searchParams)
                                    )}
                                  />
                                }
                              >
                                {subItem.label}
                                <ChevronRightIcon className='ml-auto shrink-0 transition-transform duration-200 group-data-open/subcollapsible:rotate-90' />
                              </CollapsibleTrigger>
                              <CollapsibleContent className='h-(--collapsible-panel-height) overflow-hidden transition-all duration-200 data-ending-style:h-0 data-starting-style:h-0'>
                                <SidebarMenuSub className='mx-0'>
                                  {subItem.childItems.map(leaf => (
                                    <SidebarMenuSubItem key={leaf.label}>
                                      <SidebarMenuSubButton
                                        className={subRowClass}
                                        render={<Link href={leaf.href} target={leaf.target} />}
                                        isActive={isLinkActive(leaf.href, leaf.activePath, pathname, searchParams)}
                                      >
                                        <span
                                          className={cn(
                                            'min-w-0 flex-1 truncate',
                                            leaf.badge && isExternalLink(leaf.href) && 'pr-8',
                                            leaf.badge && !isExternalLink(leaf.href) && 'pr-14',
                                            !leaf.badge && isExternalLink(leaf.href) && 'pr-6'
                                          )}
                                        >
                                          {leaf.label}
                                        </span>
                                        {leaf.badge && (
                                          <SidebarMenuBadge
                                            className={cn(
                                              badgeClass,
                                              'top-1.5!',
                                              isExternalLink(leaf.href) && 'right-6',
                                              leaf.badgeClassName
                                            )}
                                          >
                                            {leaf.badge}
                                          </SidebarMenuBadge>
                                        )}
                                        {isExternalLink(leaf.href) && (
                                          <SquareArrowOutUpRightIcon className='ml-auto size-3.5! shrink-0 opacity-50' />
                                        )}
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  ))}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </SidebarMenuSubItem>
                          </Collapsible>
                        ) : (
                          <SidebarMenuSubItem key={subItem.label}>
                            <SidebarMenuSubButton
                              className={subRowClass}
                              render={<Link href={subItem.href} target={subItem.target} />}
                              isActive={isLinkActive(subItem.href, subItem.activePath, pathname, searchParams)}
                            >
                              <span
                                className={cn(
                                  'min-w-0 flex-1 truncate',
                                  subItem.badge && isExternalLink(subItem.href) && 'pr-8',
                                  subItem.badge && !isExternalLink(subItem.href) && 'pr-14',
                                  !subItem.badge && isExternalLink(subItem.href) && 'pr-6'
                                )}
                              >
                                {subItem.label}
                              </span>
                              {subItem.badge && (
                                <SidebarMenuBadge
                                  className={cn(
                                    badgeClass,
                                    'top-1.5!',
                                    isExternalLink(subItem.href) && 'right-6',
                                    subItem.badgeClassName
                                  )}
                                >
                                  {subItem.badge}
                                </SidebarMenuBadge>
                              )}
                              {isExternalLink(subItem.href) && (
                                <SquareArrowOutUpRightIcon className='ml-auto size-3.5! shrink-0 opacity-50' />
                              )}
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )
                      )}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ) : (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  tooltip={item.label}
                  render={<Link href={item.href} target={item.target} />}
                  isActive={pathname === item.href}
                  className={cn(menuRowClass, menuRowActiveClass)}
                >
                  {Tag && <Tag />}
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate',
                      item.badge && isExternalLink(item.href) && 'pr-8',
                      item.badge && !isExternalLink(item.href) && 'pr-14',
                      !item.badge && isExternalLink(item.href) && 'pr-6'
                    )}
                  >
                    {item.label}
                  </span>
                  {item.badge && (
                    <SidebarMenuBadge
                      className={cn(badgeClass, isExternalLink(item.href) && 'right-6', item.badgeClassName)}
                    >
                      {item.badge}
                    </SidebarMenuBadge>
                  )}
                  {isExternalLink(item.href) && (
                    <SquareArrowOutUpRightIcon className='ml-auto size-3.5! shrink-0 opacity-50' />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

const SidebarLayout = () => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { state, isMobile } = useSidebar()

  const { can, flags } = useSession()

  // Branches the user has explicitly opened or closed, keyed by label. It lives here rather
  // than inside each Collapsible so it survives the swap between the inline sub-menu and the
  // icon-mode flyout — collapsing and re-expanding the sidebar keeps the tree as it was.
  // Anything absent from this map falls back to "open if it holds the active route".
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})

  // Hide what the role cannot reach and what the operator switched off. A flag that has not
  // loaded yet (or is not readable by this role) hides nothing.
  const navGroups = useMemo(() => {
    const flagOn = (flag?: string) => !flag || flags[flag] !== false
    const leafOk = (leaf: MenuLeafSubItem) => can(leaf.permission) && flagOn(leaf.flag)

    return navItems
      .map(group => ({
        ...group,
        items: group.items
          .filter(item => can(item.permission) && flagOn(item.flag))
          .map(item => {
            if (!item.childItems) return item
            const childItems = item.childItems
              .map(sub =>
                isSubGroup(sub)
                  ? can(sub.permission) && flagOn(sub.flag)
                    ? { ...sub, childItems: sub.childItems.filter(leafOk) }
                    : null
                  : leafOk(sub)
                    ? sub
                    : null
              )
              .filter((sub): sub is MenuSubItem => sub !== null && (!isSubGroup(sub) || sub.childItems.length > 0))

            return { ...item, childItems }
          })
          .filter(item => !item.childItems || item.childItems.length > 0)
      }))
      .filter(group => group.items.length > 0)
  }, [can, flags])

  const activeBranchKeys = useMemo(
    () => getActiveBranchKeys(navGroups, pathname, searchParams),
    [navGroups, pathname, searchParams]
  )

  // A user toggle wins; otherwise the branch mirrors whether it holds the active route.
  const isBranchOpen = useCallback(
    (key: string) => openItems[key] ?? activeBranchKeys.has(key),
    [openItems, activeBranchKeys]
  )

  const setOpenItem = useCallback((key: string, open: boolean) => {
    setOpenItems(prev => ({ ...prev, [key]: open }))
  }, [])

  // Only the icon rail is too narrow for the inline sub-menu. Mobile renders the full-width
  // sheet, so it keeps the normal tree.
  const isIconMode = state === 'collapsed' && !isMobile

  return (
    <Sidebar collapsible='icon' variant='sidebar'>
      <SidebarHeader className='border-sidebar-border h-16 justify-center border-b p-2'>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size='lg'
              className='gap-2.5 bg-transparent! hover:bg-transparent! [&>svg]:size-8'
              render={<Link href={`${themeConfig.homePageUrl}`} />}
            >
              <LogoSvg />
              <div className='flex min-w-0 flex-col items-start gap-0.5'>
                <span className='text-sidebar-foreground text-sm font-medium text-nowrap'>
                  {themeConfig.templateName}
                </span>
                <span className='text-muted-foreground text-xs font-normal text-nowrap'>
                  {siteConfig.tagline} · {siteConfig.environment}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className='gap-1 py-2 group-data-[collapsible=icon]:overflow-y-auto'>
        {navGroups.map((navItem, index) => {
          return (
            <SidebarGroupedMenuItems
              key={navItem.groupLabel || index}
              data={navItem.items}
              groupLabel={navItem.groupLabel}
              pathname={pathname}
              searchParams={searchParams}
              isIconMode={isIconMode}
              isBranchOpen={isBranchOpen}
              setOpenItem={setOpenItem}
            />
          )
        })}
      </SidebarContent>
    </Sidebar>
  )
}

export default SidebarLayout
