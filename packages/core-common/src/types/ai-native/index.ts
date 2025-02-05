import { CancellationToken } from '../../utils';

export interface IAINativeCapabilities {
  /**
   * Use opensumi design UI style
   */
  supportsOpenSumiDesign?: boolean;
  /**
   * Problem panel uses ai capabilities
   */
  supportsMarkers?: boolean;
  /**
   * Use ai chat capabilities
   */
  supportsChatAssistant?: boolean;
  /**
   * Use inline chat capabilities
   */
  supportsInlineChat?: boolean;
  /**
   * Use code intelligent completion capabilities
   */
  supportsInlineCompletion?: boolean;
  /**
   * Use ai to intelligently resolve conflicts
   */
  supportsConflictResolve?: boolean;
}

export interface IAINativeConfig {
  capabilities?: IAINativeCapabilities;
}

export interface IAICompletionResultModel {
  sessionId: string;
  codeModelList: Array<{ content: string }>;
  isCancel?: boolean;
}

export const AIBackSerivceToken = Symbol('AIBackSerivceToken');
export const AIBackSerivcePath = 'AIBackSerivcePath';

export interface IAIBackServiceResponse<T = string> {
  errorCode?: number;
  errorMsg?: string;
  isCancel?: boolean;
  data?: T;
}

export interface IAIBackServiceOption {
  type?: string;
  model?: string;
  enableGptCache?: boolean;
  sessionId?: string;
}

export interface IAICompletionOption {
  prompt: string;
  suffix?: string;
  language?: string;
  fileUrl?: string;
  sessionId?: string;
}

export interface IAIReportCompletionOption {
  relationId: string;
  sessionId: string;
  accept: boolean;
  repo?: string;
  completionUseTime?: number;
  renderingTime?: number;
}

export interface IAIBackService<
  BaseResponse extends IAIBackServiceResponse = IAIBackServiceResponse,
  StreamResponse extends NodeJS.ReadableStream = NodeJS.ReadableStream,
  CompletionResponse = IAICompletionResultModel,
> {
  request<O extends IAIBackServiceOption>(
    input: string,
    options: O,
    cancelToken?: CancellationToken,
  ): Promise<BaseResponse>;
  requestStream<O extends IAIBackServiceOption>(
    input: string,
    options: O,
    cancelToken?: CancellationToken,
  ): Promise<StreamResponse>;
  requestCompletion<I extends IAICompletionOption>(
    input: I,
    cancelToken?: CancellationToken,
  ): Promise<CompletionResponse>;
  reportCompletion<I extends IAIReportCompletionOption>(input: I): Promise<void>;
  destroyStreamRequest?: (sessionId: string) => Promise<void>;
}

export const AI_REPORTER_NAME = 'AI';

export enum AISerivceType {
  SearchDoc = 'searchDoc',
  SearchCode = 'searchCode',
  Sumi = 'sumi',
  GPT = 'chat',
  Explain = 'explain',
  Run = 'run',
  Test = 'test',
  Optimize = 'optimize',
  Generate = 'generate',
  Completion = 'completion',
  Agent = 'agent',
  MergeConflict = 'mergeConflict',
}

export interface CommonLogInfo {
  msgType: AISerivceType | string;
  relationId: string;
  replytime: number;
  success: boolean;
  message: string;
  isStart: boolean;
  isLike: boolean;
  // 是否有效
  isValid: boolean;
  model: string;
  copy: boolean;
  insert: boolean;
}

export interface QuestionRT extends Partial<CommonLogInfo> {
  isRetry: boolean;
  isStop: boolean;
}

export interface CodeRT extends Partial<CommonLogInfo> {
  isReceive: boolean;
  isDrop: boolean;
}

export interface GenerateRT extends Partial<CommonLogInfo> {
  fileCount: number;
  requirment: string;
}

export interface CommandRT extends Partial<CommonLogInfo> {
  useCommand: boolean;
  useCommandSuccess: boolean;
}

export interface RunRT extends Partial<CommonLogInfo> {
  runSuccess: boolean;
}

export interface CompletionRT extends Partial<CommonLogInfo> {
  isReceive?: boolean;
  // 是否取消
  isStop?: boolean;
  // 补全条数
  completionNum?: number;
  // 渲染时长
  renderingTime?: number;
}

export interface MergeConflictRT extends Partial<CommonLogInfo> {
  // 解决冲突模式 （3-way 或 传统模式）
  editorMode: '3way' | 'traditional';
  // 冲突点数量（仅包含 AI 冲突点）
  conflictPointNum: number;
  // 使用了 ai 处理的冲突点数量
  useAiConflictPointNum: number;
  // 被用户采纳了的冲突点数量
  receiveNum: number;
  // 点击了 ai 解决冲突的数量
  clickNum: number;
  // 点击了一键解决的次数
  clickAllNum: number;
  // ai 成功输出了的数量
  aiOutputNum: number;
  // 取消次数
  cancelNum: number;
}

export type ReportInfo =
  | Partial<CommonLogInfo>
  | ({ type: AISerivceType.GPT } & QuestionRT)
  | ({ type: AISerivceType.Explain } & QuestionRT)
  | ({ type: AISerivceType.SearchCode } & QuestionRT)
  | ({ type: AISerivceType.SearchDoc } & QuestionRT)
  | ({ type: AISerivceType.Test } & QuestionRT)
  | ({ type: AISerivceType.Optimize } & CodeRT)
  | ({ type: AISerivceType.Generate } & GenerateRT)
  | ({ type: AISerivceType.Sumi } & CommandRT)
  | ({ type: AISerivceType.Run } & RunRT)
  | ({ type: AISerivceType.Completion } & CompletionRT)
  | ({ type: AISerivceType.MergeConflict } & MergeConflictRT);

export const IAIReporter = Symbol('IAIReporter');

export interface IAIReporter {
  getCommonReportInfo(): Record<string, unknown>;
  getCacheReportInfo<T = ReportInfo>(relationId: string): T | undefined;
  record(data: ReportInfo, relationId?: string): ReportInfo;
  // 返回关联 ID
  start(msg: string, data: ReportInfo): string;
  end(relationId: string, data: ReportInfo): void;
}
