'use client'

import { TrailingBlockPlugin } from 'platejs'

import { AutoformatKit } from '~/components/editor/plugins/autoformat-kit'
import { BasicBlocksKit } from '~/components/editor/plugins/basic-blocks-kit'
import { BasicMarksKit } from '~/components/editor/plugins/basic-marks-kit'
import { BlockPlaceholderKit } from '~/components/editor/plugins/block-placeholder-kit'
import { ListKit } from '~/components/editor/plugins/list-kit'

export const DocumentEditorKit = [
  ...BasicBlocksKit,
  ...BasicMarksKit,
  ...ListKit,
  ...AutoformatKit,
  ...BlockPlaceholderKit,
  TrailingBlockPlugin,
]
