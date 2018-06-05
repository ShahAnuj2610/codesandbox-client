import React from 'react';
import { inject, observer } from 'mobx-react';

import moment from 'moment';
import { uniq } from 'lodash';

import Grid from 'react-virtualized/dist/commonjs/Grid';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import 'react-virtualized/styles.css';

import SandboxItem, { PADDING } from '../SandboxItem';
import Selection, { getBounds } from '../Selection';

import { Content } from './elements';

import DragLayer from '../DragLayer';

type State = {
  selection: ?{
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  },
};

const BASE_WIDTH = 290;
const BASE_HEIGHT = 242;

class SandboxGrid extends React.Component<*, State> {
  state = {
    selection: undefined,
  };

  setSandboxesSelected = (ids, { additive = false, range = false } = {}) => {
    const { store, sandboxes, signals } = this.props;
    const selectedSandboxes = store.dashboard.selectedSandboxes;
    if (range === true) {
      const indexedSandboxes = sandboxes.map((sandbox, i) => ({ sandbox, i }));

      // We need to select a range
      const firstIndexInfo = indexedSandboxes.find(
        ({ sandbox }) => selectedSandboxes.indexOf(sandbox.id) > -1
      );

      const [id] = ids;

      const lastIndexInfo = indexedSandboxes.find(
        ({ sandbox }) => sandbox.id === id
      );

      if (firstIndexInfo && lastIndexInfo) {
        const indexes = [firstIndexInfo.i, lastIndexInfo.i].sort();
        const sandboxIds = indexedSandboxes
          .map(({ sandbox }) => sandbox.id)
          .slice(indexes[0], indexes[1] + 1);

        signals.dashboard.sandboxesSelected({
          sandboxIds,
        });
        return;
      }
    }

    signals.dashboard.sandboxesSelected({
      sandboxIds: additive ? uniq([...selectedSandboxes, ...ids]) : ids,
    });
  };

  onMouseDown = (event: MouseEvent) => {
    this.setState({
      selection: {
        startX: event.clientX,
        startY: event.clientY,
        endX: event.clientX,
        endY: event.clientY,
      },
    });

    if (!event.metaKey) {
      this.setSandboxesSelected([]);
    }

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  };

  onMouseUp = () => {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    this.setState({
      selection: undefined,
    });
  };

  onMouseMove = event => {
    if (this.state.selection) {
      const newSelection = {
        ...this.state.selection,
        endX: event.clientX,
        endY: event.clientY,
      };
      this.setState({
        selection: newSelection,
      });

      const sandboxes = document.querySelectorAll('.sandbox-item');
      const selectedSandboxes = [];
      const selection = getBounds(
        newSelection.startX,
        newSelection.startY,
        newSelection.endX,
        newSelection.endY
      );

      // eslint-disable-next-line no-restricted-syntax
      for (const sandbox of sandboxes) {
        const [{ top, height, left, width }] = sandbox.getClientRects();
        const boxWidth = width - PADDING;
        const boxHeight = height - PADDING;

        if (
          (left >= selection.left || left + boxWidth >= selection.left) &&
          left <= selection.left + selection.width &&
          (top >= selection.top || top + boxHeight >= selection.top) &&
          top <= selection.top + selection.height
        ) {
          selectedSandboxes.push(sandbox);
        }
      }

      this.setSandboxesSelected(selectedSandboxes.map(el => el.id), {
        additive: event.metaKey,
      });
    }
  };

  cellRenderer = ({ rowIndex, columnIndex, key, style }) => {
    const index = rowIndex * this.columnCount + columnIndex;
    const { sandboxes, signals } = this.props;

    if (index > sandboxes.length - 1) {
      return null;
    }
    const item = sandboxes[index];

    const editedSince = moment.utc(item.updatedAt).fromNow();

    return (
      <SandboxItem
        id={item.id}
        title={item.title || item.id}
        details={editedSince}
        style={style}
        key={key}
        selected={this.selectedSandboxesObject[item.id]}
        setSandboxesSelected={this.setSandboxesSelected}
        setDragging={signals.dashboard.dragChanged}
        isDraggingItem={
          this.isDragging && this.selectedSandboxesObject[item.id]
        }
        collectionPath={item.collection.path}
      />
    );
  };

  render() {
    const { selection } = this.state;
    const { sandboxes, store } = this.props;

    const { selectedSandboxes } = this.props.store.dashboard;
    const sandboxCount = sandboxes.length;

    this.isDragging = store.dashboard.isDragging;
    this.selectedSandboxesObject = {};
    // Create an object to make it O(1)
    selectedSandboxes.forEach(id => {
      this.selectedSandboxesObject[id] = true;
    });

    return (
      <Content onMouseDown={this.onMouseDown}>
        <DragLayer />
        <AutoSizer>
          {({ width, height }) => {
            const columnCount = Math.floor(width / (BASE_WIDTH + PADDING));
            const rowCount = Math.ceil(sandboxCount / columnCount);
            const columnWidth = width / columnCount;
            this.columnCount = columnCount;

            return (
              <Grid
                style={{ outline: 'none' }}
                cellCount={sandboxCount}
                cellRenderer={this.cellRenderer}
                width={width}
                height={height}
                rowCount={rowCount}
                columnCount={columnCount}
                columnWidth={columnWidth}
                rowHeight={BASE_HEIGHT}
              />
            );
          }}
        </AutoSizer>
        {selection && <Selection {...this.state.selection} />}
      </Content>
    );
  }
}

export default inject('store', 'signals')(observer(SandboxGrid));