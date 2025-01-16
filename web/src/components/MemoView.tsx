import { Tooltip } from "@mui/joy";
import clsx from "clsx";
import { BookmarkIcon, MessageCircleMoreIcon } from "lucide-react";
import { memo, useCallback, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useUserStore, useWorkspaceSettingStore, useMemoStore, useUserStatsStore } from "@/store/v1";
import { State } from "@/types/proto/api/v1/common";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_relation_service";
import { Memo, Visibility } from "@/types/proto/api/v1/memo_service";
import { WorkspaceMemoRelatedSetting } from "@/types/proto/api/v1/workspace_setting_service";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityToString } from "@/utils/memo";
import { isSuperUser } from "@/utils/user";
import MemoActionMenu from "./MemoActionMenu";
import MemoContent from "./MemoContent";
import MemoEditor from "./MemoEditor";
import MemoLocationView from "./MemoLocationView";
import MemoReactionistView from "./MemoReactionListView";
import MemoRelationListView from "./MemoRelationListView";
import MemoResourceListView from "./MemoResourceListView";
import showPreviewImageDialog from "./PreviewImageDialog";
import ReactionSelector from "./ReactionSelector";
import UserAvatar from "./UserAvatar";
import VisibilityIcon from "./VisibilityIcon";

interface Props {
  memo: Memo;
  compact?: boolean;
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  className?: string;
  parentPage?: string;
}

const MemoView: React.FC<Props> = (props: Props) => {
  const { memo, className } = props;
  const t = useTranslate();
  const location = useLocation();
  const navigateTo = useNavigateTo();
  const currentUser = useCurrentUser();
  const userStore = useUserStore();
  const user = useCurrentUser();
  const memoStore = useMemoStore();
  const workspaceSettingStore = useWorkspaceSettingStore();
  const userStatsStore = useUserStatsStore();
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [creator, setCreator] = useState(userStore.getUserByName(memo.creator));
  const memoContainerRef = useRef<HTMLDivElement>(null);
  const workspaceMemoRelatedSetting =
    workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.MEMO_RELATED).memoRelatedSetting ||
    WorkspaceMemoRelatedSetting.fromPartial({});
  const referencedMemos = memo.relations.filter((relation) => relation.type === MemoRelation_Type.REFERENCE);
  const commentAmount = memo.relations.filter(
    (relation) => relation.type === MemoRelation_Type.COMMENT && relation.relatedMemo?.name === memo.name,
  ).length;
  const relativeTimeFormat = Date.now() - memo.displayTime!.getTime() > 1000 * 60 * 60 * 24 ? "datetime" : "auto";
  const isArchived = memo.state === State.ARCHIVED;
  const readonly = memo.creator !== user?.name && !isSuperUser(user);
  const isInMemoDetailPage = location.pathname.startsWith(`/m/${memo.uid}`);
  const parentPage = props.parentPage || location.pathname;

  // Initial related data: creator.
  useAsyncEffect(async () => {
    const user = await userStore.getOrFetchUserByName(memo.creator);
    setCreator(user);
  }, []);

  const handleGotoMemoDetailPage = useCallback(() => {
    navigateTo(`/m/${memo.uid}`, {
      state: {
        from: parentPage,
      },
    });
  }, [memo.uid, parentPage]);

  const handleMemoContentClick = useCallback(async (e: React.MouseEvent) => {
    const targetEl = e.target as HTMLElement;

    if (targetEl.tagName === "IMG") {
      const imgUrl = targetEl.getAttribute("src");
      if (imgUrl) {
        showPreviewImageDialog([imgUrl], 0);
      }
    }
  }, []);

  const handleMemoContentDoubleClick = useCallback(async (e: React.MouseEvent) => {
    if (readonly) {
      return;
    }

    if (workspaceMemoRelatedSetting.enableDoubleClickEdit) {
      e.preventDefault();
      setShowEditor(true);
    }
  }, []);

  const onEditorConfirm = () => {
    setShowEditor(false);
    userStatsStore.setStateId();
  };

  const onPinIconClick = async () => {
    if (memo.pinned) {
      await memoStore.updateMemo(
        {
          name: memo.name,
          pinned: false,
        },
        ["pinned"],
      );
    }
  };

  const displayTime = isArchived ? (
    memo.displayTime?.toLocaleString()
  ) : (
    <relative-time datetime={memo.displayTime?.toISOString()} format={relativeTimeFormat}></relative-time>
  );

  return (
    <div
      className={clsx(
        "group relative flex flex-col justify-start items-start w-full px-4 py-3 mb-2 gap-2 bg-white dark:bg-zinc-800 rounded-lg border border-white dark:border-zinc-800 hover:border-gray-200 dark:hover:border-zinc-700",
        props.showPinned && memo.pinned && "border-gray-200 border dark:border-zinc-700",
        className,
      )}
      ref={memoContainerRef}
    >
      {showEditor ? (
        <MemoEditor
          autoFocus
          className="border-none !p-0 -mb-2"
          cacheKey={`inline-memo-editor-${memo.name}`}
          memoName={memo.name}
          onConfirm={onEditorConfirm}
          onCancel={() => setShowEditor(false)}
        />
      ) : (
        <>
          <div className="w-full flex flex-row justify-between items-center gap-2">
            <div className="w-auto max-w-[calc(100%-8rem)] grow flex flex-row justify-start items-center">
              {props.showCreator && creator ? (
                <div className="w-full flex flex-row justify-start items-center">
                  <Link className="w-auto hover:opacity-80" to={`/u/${encodeURIComponent(creator.username)}`} viewTransition>
                    <UserAvatar className="mr-2 shrink-0" avatarUrl={creator.avatarUrl} />
                  </Link>
                  <div className="w-full flex flex-col justify-center items-start">
                    <Link
                      className="w-full block leading-tight hover:opacity-80 truncate text-gray-600 dark:text-gray-400"
                      to={`/u/${encodeURIComponent(creator.username)}`}
                      viewTransition
                    >
                      {creator.nickname || creator.username}
                    </Link>
                    <div
                      className="w-auto -mt-0.5 text-xs leading-tight text-gray-400 dark:text-gray-500 select-none"
                      onClick={handleGotoMemoDetailPage}
                    >
                      {displayTime}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="w-full text-sm leading-tight text-gray-400 dark:text-gray-500 select-none"
                  onClick={handleGotoMemoDetailPage}
                >
                  {displayTime}
                </div>
              )}
            </div>
            <div className="flex flex-row justify-end items-center select-none shrink-0 gap-2">
              <div className="w-auto invisible group-hover:visible flex flex-row justify-between items-center gap-2">
                {props.showVisibility && memo.visibility !== Visibility.PRIVATE && (
                  <Tooltip title={t(`memo.visibility.${convertVisibilityToString(memo.visibility).toLowerCase()}` as any)} placement="top">
                    <span className="flex justify-center items-center hover:opacity-70">
                      <VisibilityIcon visibility={memo.visibility} />
                    </span>
                  </Tooltip>
                )}
                {currentUser && !isArchived && <ReactionSelector className="border-none w-auto h-auto" memo={memo} />}
              </div>
              {!isInMemoDetailPage && (workspaceMemoRelatedSetting.enableComment || commentAmount > 0) && (
                <Link
                  className={clsx(
                    "flex flex-row justify-start items-center hover:opacity-70",
                    commentAmount === 0 && "invisible group-hover:visible",
                  )}
                  to={`/m/${memo.uid}#comments`}
                  viewTransition
                  state={{
                    from: parentPage,
                  }}
                >
                  <MessageCircleMoreIcon className="w-4 h-4 mx-auto text-gray-500 dark:text-gray-400" />
                  {commentAmount > 0 && <span className="text-xs text-gray-500 dark:text-gray-400">{commentAmount}</span>}
                </Link>
              )}
              {props.showPinned && memo.pinned && (
                <Tooltip title={t("common.unpin")} placement="top">
                  <span className="cursor-pointer">
                    <BookmarkIcon className="w-4 h-auto text-amber-500" onClick={onPinIconClick} />
                  </span>
                </Tooltip>
              )}
              <MemoActionMenu className="-ml-1" memo={memo} readonly={readonly} onEdit={() => setShowEditor(true)} />
            </div>
          </div>
          <MemoContent
            key={`${memo.name}-${memo.updateTime}`}
            memoName={memo.name}
            nodes={memo.nodes}
            readonly={readonly}
            onClick={handleMemoContentClick}
            onDoubleClick={handleMemoContentDoubleClick}
            compact={props.compact && workspaceMemoRelatedSetting.enableAutoCompact}
            parentPage={parentPage}
          />
          {memo.location && <MemoLocationView location={memo.location} />}
          <MemoResourceListView resources={memo.resources} />
          <MemoRelationListView memo={memo} relations={referencedMemos} parentPage={parentPage} />
          <MemoReactionistView memo={memo} reactions={memo.reactions} />
        </>
      )}
    </div>
  );
};

export default memo(MemoView);
