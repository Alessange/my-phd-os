import {
  CCF_RANKS,
  CCF_SUBJECT_CODES,
  CORE_RANKS,
  THCPL_RANKS,
  type CcfRank,
  type CcfSubjectCode,
  type CoreRank,
  type ThcplRank
} from '../types/conference'

export interface CcfSubject {
  code: CcfSubjectCode
  name_en: string
  name_zh: string
}

/** Subjects from upstream `conference/types.yml` (see docs/upstream-ccf-feed.md). */
export const CCF_SUBJECTS: readonly CcfSubject[] = [
  {
    code: 'DS',
    name_en: 'Computer Architecture/Parallel Programming/Storage Technology',
    name_zh: '计算机体系结构/并行与分布计算/存储系统'
  },
  { code: 'NW', name_en: 'Network System', name_zh: '计算机网络' },
  { code: 'SC', name_en: 'Network and System Security', name_zh: '网络与信息安全' },
  {
    code: 'SE',
    name_en: 'Software Engineering/Operating System/Programming Language Design',
    name_zh: '软件工程/系统软件/程序设计语言'
  },
  {
    code: 'DB',
    name_en: 'Database/Data Mining/Information Retrieval',
    name_zh: '数据库/数据挖掘/内容检索'
  },
  { code: 'CT', name_en: 'Computing Theory', name_zh: '计算机科学理论' },
  { code: 'CG', name_en: 'Graphics', name_zh: '计算机图形学与多媒体' },
  { code: 'AI', name_en: 'Artificial Intelligence', name_zh: '人工智能' },
  { code: 'HI', name_en: 'Computer-Human Interaction', name_zh: '人机交互与普适计算' },
  { code: 'MX', name_en: 'Interdiscipline/Mixture/Emerging', name_zh: '交叉/综合/新兴' }
]

export const CCF_SUBJECT_BY_CODE: Readonly<Record<CcfSubjectCode, CcfSubject>> = Object.fromEntries(
  CCF_SUBJECTS.map((s) => [s.code, s])
) as Record<CcfSubjectCode, CcfSubject>

export const isCcfSubjectCode = (value: string): value is CcfSubjectCode =>
  (CCF_SUBJECT_CODES as readonly string[]).includes(value)

export interface RankOption<R extends string> {
  value: R
  label: string
  /** Segment used in the official filename (`A*` → `Astar`). */
  urlSegment: string
}

const rankOption = <R extends string>(value: R): RankOption<R> => ({
  value,
  label: value,
  urlSegment: encodeRankForUrl(value)
})

/** `A*` is written `Astar` in official filenames. */
export const encodeRankForUrl = (rank: string): string => rank.replace('*', 'star')

export const CCF_RANK_OPTIONS: readonly RankOption<CcfRank>[] = CCF_RANKS.map(rankOption)
export const CORE_RANK_OPTIONS: readonly RankOption<CoreRank>[] = CORE_RANKS.map(rankOption)
export const THCPL_RANK_OPTIONS: readonly RankOption<ThcplRank>[] = THCPL_RANKS.map(rankOption)

/** Ordered filter components in the official filename convention. */
export const FILTER_ORDER = ['ccf', 'core', 'thcpl', 'subject'] as const

export const SUBSCRIPTION_LANGUAGE_LABELS = { en: 'English', zh: '简体中文' } as const
