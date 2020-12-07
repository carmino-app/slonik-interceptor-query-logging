// @flow

import {
  serializeError,
} from 'serialize-error';
import type {
  InterceptorType,
  ConnectionContextType,
} from 'slonik';
import {
  filter,
  map,
} from 'inline-loops.macro';
import prettyMs from 'pretty-ms';
import type {
  LoggerType,
} from 'roarr';
import {
  getAutoExplainPayload,
  isAutoExplainJsonMessage,
} from '../utilities';

/**
 * @property logValues Dictates whether to include parameter values used to execute the query. (default: true)
 */
type UserConfigurationType = {|
  +logger: (context: ConnectionContextType) => LoggerType,
  +logValues: boolean,
|};

const stringifyCallSite = (callSite) => {
  return (callSite.fileName || '') + ':' + callSite.lineNumber + ':' + callSite.columnNumber;
};

const defaultConfiguration = {
  logger: (context: ConnectionContextType) => {
    return context.log;
  },
  logValues: true,
};

export default (userConfiguration?: UserConfigurationType): InterceptorType => {
  const configuration = {
    ...defaultConfiguration,
    ...userConfiguration,
  };

  return {
    afterQueryExecution: (context, query, result) => {
      let rowCount: number | null = null;

      if (result.rowCount) {
        rowCount = result.rowCount;
      }

      for (const notice of result.notices) {
        if (isAutoExplainJsonMessage(notice.message)) {
          configuration.logger(context).info({
            autoExplain: getAutoExplainPayload(notice.message),
          }, 'auto explain');
        }
      }

      configuration.logger(context).debug({
        executionTime: prettyMs(Number(process.hrtime.bigint() - context.queryInputTime) / 1000000),
        rowCount,
      }, 'query execution result');

      return null;
    },
    beforeQueryExecution: async (context, query) => {
      let stackTrace;

      if (context.stackTrace) {
        stackTrace = map(
          filter(context.stackTrace, (callSite) => {
            // Hide the internal call sites.
            return callSite.fileName !== null && !callSite.fileName.includes('slonik') && !callSite.fileName.includes('next_tick');
          }),
          (callSite) => {
            return stringifyCallSite(callSite);
          },
        );
      }

      let values;

      if (configuration.logValues) {
        values = map(query.values, (value) => {
          if (Buffer.isBuffer(value)) {
            return '[Buffer ' + value.byteLength + ']';
          }

          return value;
        });
      }

      configuration.logger(context).debug({
        sql: query.sql,
        stackTrace,
        values,
      }, 'executing query');

      return null;
    },
    queryExecutionError: (context, query, error) => {
      configuration.logger(context).error({
        error: serializeError(error),
      }, 'query execution produced an error');

      return null;
    },
  };
};
