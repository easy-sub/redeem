export const ORDER_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
	MANUAL_COMPLETED: 'MANUAL_COMPLETED',
  PARTIAL_CLOSED: 'PARTIAL_CLOSED',
  EXCEPTION: 'EXCEPTION',
  CARD_RETURNED: 'CARD_RETURNED',
  RETRYING: 'RETRYING',
  CANCELED: 'CANCELED'
}

const ORDER_STATUS_ALIASES = {
  1: ORDER_STATUS.PENDING,
  2: ORDER_STATUS.PROCESSING,
  3: ORDER_STATUS.COMPLETED,
  4: ORDER_STATUS.EXCEPTION,
  5: ORDER_STATUS.CARD_RETURNED,
  6: ORDER_STATUS.RETRYING,
  7: ORDER_STATUS.CANCELED
}

const ORDER_STATUS_MAP = {
  [ORDER_STATUS.PENDING]: {
    text: '待处理',
    className: 'status-pending'
  },
  [ORDER_STATUS.PROCESSING]: {
    text: '处理中',
    className: 'status-processing'
  },
  [ORDER_STATUS.COMPLETED]: {
    text: '已完成',
    className: 'status-completed'
  },
	[ORDER_STATUS.MANUAL_COMPLETED]: {
		text: '人工处理完成',
		className: 'status-completed'
	},
  [ORDER_STATUS.PARTIAL_CLOSED]: {
    text: '部分履约已关闭',
    className: 'status-partial'
  },
  [ORDER_STATUS.EXCEPTION]: {
    text: '异常',
    className: 'status-error',
    tip: '请联系购卡处处理'
  },
  [ORDER_STATUS.CARD_RETURNED]: {
    text: 'CDK 已释放',
    className: 'status-returned'
  },
  [ORDER_STATUS.RETRYING]: {
    text: '等待重试',
    className: 'status-retrying'
  },
  [ORDER_STATUS.CANCELED]: {
    text: '已取消',
    className: 'status-canceled'
  }
}

const UNKNOWN_STATUS = {
  text: '未知状态',
  className: 'status-unknown'
}

export const normalizeOrderStatus = (status) => {
  if (status === null || status === undefined) return ''
  return ORDER_STATUS_ALIASES[status] || String(status).toUpperCase()
}

export const getOrderStatus = (status) => {
  return ORDER_STATUS_MAP[normalizeOrderStatus(status)] || UNKNOWN_STATUS
}

export const getOrderStatusText = (status) => getOrderStatus(status).text

export const getOrderStatusClass = (status) => getOrderStatus(status).className

export const getOrderStatusTip = (status) => getOrderStatus(status).tip || ''
