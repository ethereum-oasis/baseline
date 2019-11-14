import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(() => ({
  root: {
    overflowX: 'scroll',
    maxHeight: '100%',
    width: '600px',
    background: '#f8fafb',
    borderRight: '1px solid #5f747f',
  },
}));

const Sidebar = ({ children }) => {
  const classes = useStyles();

  return <div className={classes.root}>{children}</div>;
};

Sidebar.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Sidebar;