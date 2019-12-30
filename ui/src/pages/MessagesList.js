import React, { useContext } from 'react';
import { PropTypes } from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Chip from '@material-ui/core/Chip';
import { groupBy, filter } from 'lodash';
import Layout from '../components/Layout';
import Sidebar from '../components/Sidebar';
import PageWrapper from '../components/PageWrapper';
import SideNav from '../components/SideNav';
import { MessageContext } from '../contexts/message-context';
import MessagesTable from '../components/MessageList/MessagesTable';

const useStyles = makeStyles(() => ({
  root: {
    position: 'relative',
  },
  list: {
    background: '#f3f6f8',
  },
  link: {
    textDecoration: 'none',
    display: 'block',
  },
  selected: {
    background: '#dee3e7',
  },
  contents: {
    padding: '0 1rem',
  },
  silver: {
    background: 'silver',
  },
  red: {
    background: 'red',
  },
  bold: {
    fontWeight: 'bold',
  },
  row: {
    background: 'white',
  },
  resolved: {
    background: 'rgba(242,245,245,0.8)',
  },
  categoryColumn: {
    width: '210px',
  },
  subjectColumn: {
    // width: '400px',
  },
  partnerColumn: {
    width: '200px',
  },
  lastModifiedColumn: {
    width: '200px',
  },
}));

const chipStyles = makeStyles(() => ({
  default: {
    borderColor: 'black',
  },
  msa: {
    borderColor: 'red',
  },
  procurementRequest: {
    borderColor: 'green',
  },
  invoice: {
    borderColor: 'blue',
  },
  rfp: {
    borderColor: 'lime',
  },
  purchaseOrder: {
    borderColor: 'orange',
  },
}));

const ChipMaker = ({ value, row }) => {
  const classes = chipStyles();

  const labels = {
    msa: 'MSA',
    procurementrequest: 'PRO',
    invoice: 'INV',
    rfp: 'RFP',
    purchaseorder: 'PO',
    proposal: 'Proposal',
  };

  return (
    <Chip
      variant="outlined"
      size="small"
      className={classes[value]}
      label={`${labels[value]}: ${row.status}`}
    />
  );
};

ChipMaker.propTypes = {
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.node,
    PropTypes.element,
  ]).isRequired,
  row: PropTypes.shape({
    status: PropTypes.string,
  }).isRequired,
};

const categories = ['msa', 'purchaseorder', 'invoice', 'rfp', 'inbox', 'outbox'];

const MessagesList = ({ match }) => {
  const classes = useStyles();
  const { messages } = useContext(MessageContext);
  const { category } = match.params || null;
  const groups = groupBy(messages, 'category');
  const mailboxes = groupBy(messages, 'status');
  let rows = [];

  if (categories.includes(category)) {
    rows = groups[category];
  }

  if (category === 'inbox' || category === 'outbox') {
    if (category === 'inbox') {
      rows = filter(mailboxes.incoming, ['resolved', false]);
    } else if (category === 'outbox') {
      rows = filter(mailboxes.outgoing, ['resolved', false]);
    }
  }

  const columns = [
    {
      name: 'category',
      label: 'Category',
      component: ChipMaker,
      headerCellClasses: {
        [classes.categoryColumn]: true,
      },
      cellClasses: {
        [classes.bold]: (value, { row }) => row.new,
      },
    },
    {
      name: 'from',
      label: 'From',
      headerCellClasses: {
        [classes.partnerColumn]: true,
      },
      cellClasses: {
        [classes.bold]: (value, { row }) => row.new,
      },
    },
    {
      name: 'subject',
      label: 'Subject',
      headerCellClasses: {
        [classes.subjectColumn]: true,
      },
      cellClasses: {
        [classes.bold]: (value, { row }) => row.new,
      },
    },
    {
      name: 'lastModified',
      label: 'Last Modified',
      align: 'right',
      headerCellClasses: {
        [classes.lastModifiedColumn]: true,
      },
      cellClasses: {
        [classes.bold]: (value, { row }) => row.new,
      },
    },
    {
      name: 'resolved',
      label: 'Resolved',
      align: 'right',
      formatter: value => (value ? 'yes' : 'no'),
    },
  ];

  const options = {
    key: '_id',
    rowClasses: {
      [classes.row]: true,
      [classes.resolved]: (value, { row }) => row.resolved,
    },
  };

  return (
    <Layout>
      <Sidebar>
        <SideNav messages={messages} />
      </Sidebar>
      <PageWrapper>
        <MessagesTable columns={columns} options={options} messages={rows} />
      </PageWrapper>
    </Layout>
  );
};

MessagesList.propTypes = {
  match: PropTypes.shape({
    params: PropTypes.shape({}).isRequired,
  }).isRequired,
};

export default MessagesList;