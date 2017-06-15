import java.net.InetSocketAddress;
import java.util.HashMap;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import saltchannel.ByteChannel;
import saltchannel.ComException;
import saltchannel.v2.SaltServerSession;
import saltchannel.util.KeyPair;
import saltchannel.util.Rand;
import saltchannel.CryptoLib;
import saltchannel.v1.ServerChannelV1;

/**
 * WebSocket Salt Channel test server. Echos bytes back to client.
 * Server's signature key pair is hard-coded. Also, server's encryption (key agreement) 
 * key pair is hardcoded. NOTE: this is *not* secure, the encryption key
 * pair must be re-generated for each session to achieve security.
 * 
 * @author Frans Lundberg
 */
public class TestServer {
    public static final int DEFAULT_PORT = 2034;
    private int version;
    private final int port;
    private HashMap<WebSocket, WebSocketInfo> sockets = new HashMap<>();
    private KeyPair sigKeyPair;
    private KeyPair encKeyPair;

    public TestServer() {
        this.port = DEFAULT_PORT;
        this.version = 1;    // 1 for SCv1, 2 for SCv2

        this.sigKeyPair = KeyPair.fromHex(
            "19b1e1c37fbde7aa35129b836ec26a2d2c252159ad8ceff820e33683df02fafa64025780401a25d6a8ba2150db13c1b0efd1a3d7c0b53ac635d4b14a8bab3af8",
            "64025780401a25d6a8ba2150db13c1b0efd1a3d7c0b53ac635d4b14a8bab3af8"
        );

        this.encKeyPair = KeyPair.fromHex(
            "88a87764a1f9a44cd072b3020889a32ae83993bc48315a92c0d600549958297f",
            "11cee867e04e020eb0c28b46a7bc25b8ee239c64a97543e65c889a7ef9fca615"
        );
    }
    
    public static void main(String[] args) {
        new TestServer().go();
    }

    public void go() {
        System.out.println(TestServer.class.getName() 
                + ", starting WebSocket server on port " + port 
                + ". Salt Channel " + getVersionString() + " echo server");
        start();
    }

    public void start() {
        InetSocketAddress address = new InetSocketAddress(port);
        WebSocketServer server = new WebSocketServer(address) {
            @Override
            public void onClose(WebSocket socket, int code, String reason, boolean remote) {
                synchronized (this) {
                    sockets.remove(socket);
                }
            }

            @Override
            public void onError(WebSocket socket, Exception ex) {
                System.out.println("SERVER, onError, " + ex);
            }
            
            @Override
            public void onMessage(WebSocket socket, java.nio.ByteBuffer message) {
                byte[] bytes = message.array();
                synchronized (this) {
                    WebSocketInfo info = sockets.get(socket);
                    if (info != null) {
                        info.messageQ.add(bytes);
                    }
                }
            }

            @Override
            public void onMessage(WebSocket socket, String message) {
                // Should never happen, ignore.
            }

            @Override
            public void onOpen(final WebSocket socket, ClientHandshake handshake) {                
                Thread thread = new Thread(new Runnable() {
                    public void run() {
                        handleSocket(socket);
                    }
                });
                
                thread.start();
            }
        };
        
        server.start();
    }

    private void handleSocket(final WebSocket socket) {
        final WebSocketInfo socketInfo = new WebSocketInfo();
        
        System.out.println("Client connected, " + socket);

        try {
            synchronized (this) {
                sockets.put(socket, socketInfo);
            }
            
            ByteChannel lowerChannel = new ByteChannel() {
                public byte[] read() throws ComException {
                    try {
                        return socketInfo.messageQ.take();
                    } catch (InterruptedException e) {
                        throw new ComException(e.getMessage());
                    }
                }

                public void write(byte[]... messages) throws ComException {
                    for (int i = 0; i < messages.length; i++) {
                        socket.send(messages[i]);
                    }
                }
            };
            
            ByteChannel appChannel;

            if (version == 2) {
                SaltServerSession serverSession = new SaltServerSession(sigKeyPair, lowerChannel);
                serverSession.setEncKeyPair(encKeyPair);
                serverSession.handshake();
                appChannel = serverSession.getChannel();
            } else if (version == 1) {
                ServerChannelV1 v1channel = new ServerChannelV1(lowerChannel);
                v1channel.handshake(sigKeyPair, encKeyPair);
                appChannel = v1channel;
            } else {
                throw new Error("bad version, " + version);
            }

            System.out.println(getVersionString() + " handshake completed.");

            while (true) {
                byte[] bytes = appChannel.read();
                if (bytes.length < 1) {
                    throw new ComException("too short message from client, " + bytes.length);
                }

                byte first = bytes[0];
                if (first == 0) {
                    break;
                } else if (first == 1) {
                    appChannel.write(bytes);
                } else {
                    throw new ComException("bad client, first = " + (int) first);
                }
            }
            
        } finally {
            synchronized (this) {
                sockets.remove(socket);
            }
        }
    }

    private String getVersionString() {
        return "v" + version;
    }

    private static class WebSocketInfo {
        BlockingQueue<byte[]> messageQ;
        
        WebSocketInfo() {
            this.messageQ = new LinkedBlockingQueue<byte[]>();
        }
    }
}

