import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ReaderTopOverlay } from "./ReaderTopOverlay";

const meta: Meta<typeof ReaderTopOverlay> = {
  title: "Reader/ReaderTopOverlay",
  component: ReaderTopOverlay,
  decorators: [
    (Story) => (
      <div className="min-h-screen relative bg-slate-100 dark:bg-slate-900">
        <Story />
      </div>
    ),
  ],
  args: {
    isOpen: true,
    novelTitle: "無職転生 〜異世界行ったら本気だす〜",
    chapterTitle: "第1話 異世界転生",
    onBackToToc: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ReaderTopOverlay>;

/**
 * デフォルト表示（オーバーレイ展開中・通常タイトル）
 */
export const Default: Story = {
  name: "デフォルト（展開中）",
  args: {
    isOpen: true,
    novelTitle: "無職転生 〜異世界行ったら本気だす〜",
    chapterTitle: "第1話 異世界転生",
  },
};

/**
 * 非表示（画面外へスライド退避中）
 */
export const Closed: Story = {
  name: "非表示（スライド退避中）",
  args: {
    isOpen: false,
    novelTitle: "無職転生 〜異世界行ったら本気だす〜",
    chapterTitle: "第1話 異世界転生",
  },
};

/**
 * 100文字超の超長文タイトル・サブタイトル（1行固定・省略表示保護）
 */
export const LongTitle: Story = {
  name: "超長文タイトル（1行省略保護）",
  args: {
    isOpen: true,
    novelTitle:
      "ダンジョンに出会いを求めるのは間違っているだろうか外伝 ソード・オラトリア ダンジョン深層探索記録特別編 100文字を超える非常に長い作品タイトルのテストケースです。あいうえおかきくけこさしすせそたちつてとなにぬねの",
    chapterTitle:
      "第100話 迷宮の奥底で最強の戦士たちと出会い過酷な運命に立ち向かう少年少女たちの壮絶な戦いと絆を描く感動のエピソードサブタイトル長文検証用テストテキスト1234567890abcdefghijklmnopqrstuvwxyz",
  },
};
