import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatBars from '../src/renderer/components/StatBars.vue'
import MatchList from '../src/renderer/components/MatchList.vue'
import type { WinRateStat, MatchRecord } from '../src/shared/types'

describe('StatBars', () => {
  const stats: WinRateStat[] = [
    { label: 'Genji', games: 10, wins: 7, winRate: 0.7 },
    { label: 'Jaina', games: 5, wins: 2, winRate: 0.4 },
  ]

  it('renders a list item for each stat', () => {
    const wrapper = mount(StatBars, { props: { title: 'Hero Stats', stats } })
    expect(wrapper.findAll('.bar-row')).toHaveLength(2)
    expect(wrapper.text()).toContain('Genji')
    expect(wrapper.text()).toContain('Jaina')
  })

  it('shows win rate as percentage', () => {
    const wrapper = mount(StatBars, { props: { title: 'Hero Stats', stats } })
    expect(wrapper.text()).toContain('70%')
    expect(wrapper.text()).toContain('40%')
  })

  it('shows game counts', () => {
    const wrapper = mount(StatBars, { props: { title: 'Hero Stats', stats } })
    expect(wrapper.text()).toContain('10 games')
    expect(wrapper.text()).toContain('5 games')
  })

  it('shows empty message when no stats', () => {
    const wrapper = mount(StatBars, { props: { title: 'Hero Stats', stats: [] } })
    expect(wrapper.text()).toContain('No Storm League matches')
  })

  it('displays the title', () => {
    const wrapper = mount(StatBars, { props: { title: 'Map Stats', stats } })
    expect(wrapper.text()).toContain('Map Stats')
  })

  it('applies bar-green class when colorMode is winrate and winRate > 0.55', () => {
    const wrapper = mount(StatBars, { props: { title: 'Hero Stats', stats, colorMode: 'winrate' } })
    const fills = wrapper.findAll('.bar-fill')
    expect(fills[0].classes()).toContain('bar-green')
    expect(fills[1].classes()).toContain('bar-red')
  })

  it('applies bar-red class when colorMode is winrate and winRate < 0.45', () => {
    const lowStats: WinRateStat[] = [{ label: 'Medivh', games: 10, wins: 2, winRate: 0.2 }]
    const wrapper = mount(StatBars, { props: { title: 'Hero Stats', stats: lowStats, colorMode: 'winrate' } })
    expect(wrapper.find('.bar-fill').classes()).toContain('bar-red')
  })

  it('applies bar-blue class when colorMode is winrate and winRate is 0.45-0.55', () => {
    const midStats: WinRateStat[] = [{ label: 'Valla', games: 10, wins: 5, winRate: 0.5 }]
    const wrapper = mount(StatBars, { props: { title: 'Hero Stats', stats: midStats, colorMode: 'winrate' } })
    expect(wrapper.find('.bar-fill').classes()).toContain('bar-blue')
  })

  it('applies opacity based on game count when colorMode is winrate', () => {
    const wrapper = mount(StatBars, { props: { title: 'Hero Stats', stats, colorMode: 'winrate' } })
    const fills = wrapper.findAll('.bar-fill')
    // Genji: 10 games → opacity = 0.5 + (10/20)*0.5 = 0.75
    expect(fills[0].attributes('style')).toContain('opacity: 0.75')
    // Jaina: 5 games → opacity = 0.5 + (5/20)*0.5 = 0.625
    expect(fills[1].attributes('style')).toContain('opacity: 0.625')
  })

  it('no color classes when colorMode is not winrate', () => {
    const wrapper = mount(StatBars, { props: { title: 'Hero Stats', stats } })
    const fills = wrapper.findAll('.bar-fill')
    expect(fills[0].classes()).not.toContain('bar-green')
    expect(fills[0].classes()).not.toContain('bar-red')
    expect(fills[0].classes()).not.toContain('bar-blue')
  })
})

describe('MatchList', () => {
  const matches: MatchRecord[] = [
    { sourcePath: '/1.StormReplay', playedAt: '2026-07-22T20:00:00Z', gameMode: 'stormLeague', mapName: 'AlteracPass', heroName: 'Genji', won: true, partySize: 1, importedAt: '2026-07-22T21:00:00Z' },
    { sourcePath: '/2.StormReplay', playedAt: '2026-07-21T18:00:00Z', gameMode: 'stormLeague', mapName: 'BraxisHoldout', heroName: 'Jaina', won: false, partySize: 3, importedAt: '2026-07-22T21:00:00Z' },
    { sourcePath: '/3.StormReplay', playedAt: '2026-07-20T15:00:00Z', gameMode: 'stormLeague', mapName: 'AlteracPass', heroName: 'ETC', won: true, partySize: 2, importedAt: '2026-07-22T21:00:00Z' },
    { sourcePath: '/4.StormReplay', playedAt: '2026-07-19T12:00:00Z', gameMode: 'stormLeague', mapName: 'TombOfTheSpiderQueen', heroName: 'LiMing', won: true, partySize: 1, importedAt: '2026-07-22T21:00:00Z' },
  ]

  it('collapsed shows 3 most recent matches', () => {
    const wrapper = mount(MatchList, { props: { matches, total: 4 } })
    // Collapsed by default — shows mini rows
    expect(wrapper.findAll('.match-mini-row')).toHaveLength(3)
    expect(wrapper.text()).toContain('Genji')
    expect(wrapper.text()).toContain('Jaina')
    expect(wrapper.text()).toContain('ETC')
  })

  it('expanded shows full table', async () => {
    const wrapper = mount(MatchList, { props: { matches, total: 4 } })
    await wrapper.find('.match-list-header').trigger('click')
    expect(wrapper.find('.match-table').exists()).toBe(true)
    expect(wrapper.findAll('.match-table tbody tr')).toHaveLength(4)
  })

  it('shows total count in header', () => {
    const wrapper = mount(MatchList, { props: { matches, total: 10 } })
    expect(wrapper.text()).toContain('10 total')
  })

  it('shows win/loss pills', () => {
    const wrapper = mount(MatchList, { props: { matches, total: 4 } })
    expect(wrapper.findAll('.match-pill.win').length).toBeGreaterThan(0)
    expect(wrapper.findAll('.match-pill.loss').length).toBeGreaterThan(0)
  })

  it('shows empty message when no matches', () => {
    const wrapper = mount(MatchList, { props: { matches: [], total: 0 } })
    expect(wrapper.text()).toContain('No matches')
  })

  it('shows party size', () => {
    const wrapper = mount(MatchList, { props: { matches, total: 4 } })
    expect(wrapper.text()).toContain('P1')
    expect(wrapper.text()).toContain('P3')
    expect(wrapper.text()).toContain('P2')
  })
})
