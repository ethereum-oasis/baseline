#!/usr/bin/env bash
#   Use this script to test if a given TCP host/port are available

AWAIT_cmdname=${0##*/}

echoerr() { if [[ $AWAIT_QUIET -ne 1 ]]; then echo "$@" 1>&2; fi }

usage()
{
    cat << USAGE >&2
Usage:
    $AWAIT_cmdname host:port [-s] [-t timeout] [-- command args]
    -h HOST | --host=HOST       Host or IP under test
    -p PORT | --port=PORT       TCP port under test
                                Alternatively, you specify the host and port as host:port
    -s | --strict               Only execute subcommand if the test succeeds
    -q | --quiet                Don't output any status messages
    -t TIMEOUT | --timeout=TIMEOUT
                                Timeout in seconds, zero for no timeout
    -- COMMAND ARGS             Execute command with args after the test finishes
USAGE
    exit 1
}

wait_for()
{
    if [[ $AWAIT_TIMEOUT -gt 0 ]]; then
        echoerr "$AWAIT_cmdname: waiting $AWAIT_TIMEOUT seconds for $AWAIT_HOST:$AWAIT_PORT"
    else
        echoerr "$AWAIT_cmdname: waiting for $AWAIT_HOST:$AWAIT_PORT without a timeout"
    fi
    AWAIT_start_ts=$(date +%s)
    while :
    do
        if [[ $AWAIT_ISBUSY -eq 1 ]]; then
            nc -z $AWAIT_HOST $AWAIT_PORT
            AWAIT_result=$?
        else
            (echo > /dev/tcp/$AWAIT_HOST/$AWAIT_PORT) >/dev/null 2>&1
            AWAIT_result=$?
        fi
        if [[ $AWAIT_result -eq 0 ]]; then
            AWAIT_end_ts=$(date +%s)
            echoerr "$AWAIT_cmdname: $AWAIT_HOST:$AWAIT_PORT is available after $((AWAIT_end_ts - AWAIT_start_ts)) seconds"
            break
        fi
        sleep 1
    done
    return $AWAIT_result
}

wait_for_wrapper()
{
    # In order to support SIGINT during timeout: http://unix.stackexchange.com/a/57692
    if [[ $AWAIT_QUIET -eq 1 ]]; then
        timeout $AWAIT_BUSYTIMEFLAG $AWAIT_TIMEOUT bash $0 --quiet --child --host=$AWAIT_HOST --port=$AWAIT_PORT --timeout=$AWAIT_TIMEOUT &
    else
        timeout $AWAIT_BUSYTIMEFLAG $AWAIT_TIMEOUT bash $0 --child --host=$AWAIT_HOST --port=$AWAIT_PORT --timeout=$AWAIT_TIMEOUT &
    fi
    AWAIT_PID=$!
    trap "kill -INT -$AWAIT_PID" INT
    wait $AWAIT_PID
    AWAIT_RESULT=$?
    if [[ $AWAIT_RESULT -ne 0 ]]; then
        echoerr "$AWAIT_cmdname: timeout occurred after waiting $AWAIT_TIMEOUT seconds for $AWAIT_HOST:$AWAIT_PORT"
    fi
    return $AWAIT_RESULT
}

# process arguments
while [[ $# -gt 0 ]]
do
    case "$1" in
        *:* )
        AWAIT_hostport=(${1//:/ })
        AWAIT_HOST=${AWAIT_hostport[0]}
        AWAIT_PORT=${AWAIT_hostport[1]}
        shift 1
        ;;
        --child)
        AWAIT_CHILD=1
        shift 1
        ;;
        -q | --quiet)
        AWAIT_QUIET=1
        shift 1
        ;;
        -s | --strict)
        AWAIT_STRICT=1
        shift 1
        ;;
        -h)
        AWAIT_HOST="$2"
        if [[ $AWAIT_HOST == "" ]]; then break; fi
        shift 2
        ;;
        --host=*)
        AWAIT_HOST="${1#*=}"
        shift 1
        ;;
        -p)
        AWAIT_PORT="$2"
        if [[ $AWAIT_PORT == "" ]]; then break; fi
        shift 2
        ;;
        --port=*)
        AWAIT_PORT="${1#*=}"
        shift 1
        ;;
        -t)
        AWAIT_TIMEOUT="$2"
        if [[ $AWAIT_TIMEOUT == "" ]]; then break; fi
        shift 2
        ;;
        --timeout=*)
        AWAIT_TIMEOUT="${1#*=}"
        shift 1
        ;;
        --)
        shift
        AWAIT_CLI=("$@")
        break
        ;;
        --help)
        usage
        ;;
        *)
        echoerr "Unknown argument: $1"
        usage
        ;;
    esac
done

if [[ "$AWAIT_HOST" == "" || "$AWAIT_PORT" == "" ]]; then
    echoerr "Error: you need to provide a host and port to test."
    usage
fi

AWAIT_TIMEOUT=${AWAIT_TIMEOUT:-15}
AWAIT_STRICT=${AWAIT_STRICT:-0}
AWAIT_CHILD=${AWAIT_CHILD:-0}
AWAIT_QUIET=${AWAIT_QUIET:-0}

# check to see if timeout is from busybox?
AWAIT_TIMEOUT_PATH=$(type -p timeout)
AWAIT_TIMEOUT_PATH=$(realpath $AWAIT_TIMEOUT_PATH 2>/dev/null || readlink -f $AWAIT_TIMEOUT_PATH)
AWAIT_BUSYTIMEFLAG=""
if [[ $AWAIT_TIMEOUT_PATH =~ "busybox" ]]; then
        AWAIT_ISBUSY=1
else
        AWAIT_ISBUSY=0
fi

if [[ $AWAIT_CHILD -gt 0 ]]; then
    wait_for
    AWAIT_RESULT=$?
    exit $AWAIT_RESULT
else
    if [[ $AWAIT_TIMEOUT -gt 0 ]]; then
        wait_for_wrapper
        AWAIT_RESULT=$?
    else
        wait_for
        AWAIT_RESULT=$?
    fi
fi

if [[ $AWAIT_CLI != "" ]]; then
    if [[ $AWAIT_RESULT -ne 0 && $AWAIT_STRICT -eq 1 ]]; then
        echoerr "$AWAIT_cmdname: strict mode, refusing to execute subprocess"
        exit $AWAIT_RESULT
    fi
    exec "${AWAIT_CLI[@]}"
else
    exit $AWAIT_RESULT
fi
