import React from 'react';
import { PropTypes } from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import { checkClasses } from './utils';

const useStyles = makeStyles(() => ({
  headerCell: {},
  truncate: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}));

const Row = props => {
  const { columns, row, rows, options } = props;
  const classes = useStyles();
  const key = row[options.key];
  const rowClassnames = checkClasses(options.rowClasses, { row });
  const rowClasses = classNames(classes.row, rowClassnames);

  return (
    <TableRow className={rowClasses}>
      {columns.map(column => {
        const data = { column, columns, row, rows, options };
        const columnClassnames = checkClasses(column.columnClasses, data);
        const cellClassnames = checkClasses(column.cellClasses, data);
        const cellClasses = classNames(columnClassnames, cellClassnames);

        const value = column.formatter
          ? column.formatter(row[column.name], props)
          : row[column.name];

        const content = column.component ? (
          <column.component value={value} {...props}>
            {value}
          </column.component>
        ) : (
          <>{value}</>
        );

        return (
          <TableCell
            key={`row-${key}-cell-${column.name}`}
            className={cellClasses}
            align={column.align ? column.align : 'left'}
          >
            <div className={classes.truncate}>{content}</div>
          </TableCell>
        );
      })}
    </TableRow>
  );
};

Row.propTypes = {
  row: PropTypes.shape({}).isRequired,
  rows: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  options: PropTypes.shape({
    key: PropTypes.string.isRequired,
    rowClasses: PropTypes.shape({}),
  }).isRequired,
};
export default Row;
