<div class="content-wrapper">
    <section class="content-header">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-12">
                    <div class="card card-info">
                        <div class="card-header">
                            <h3 class="card-title">PENGUMUMAN</h3>
                            <div class="card-tools">
                                <a href="<?= site_url('Administrator/tambah_pengumuman') ?>" class="btn btn-tool">
                                    <i class="fas fa-chalkboard-teacher"></i>
                                </a>

                            </div>
                        </div>
                        <div class="card-body">
                            <table class="table table-stripped" id="example2">
                                <thead>
                                    <tr>
                                        <th>No.</th>
                                        <th>Gambar Pengumuman</th>
                                        <th>Judul Pengumuman</th>
                                        <th>File Pengumuman</th>
                                        <th>Tanggal Upload</th>
                                        <th>View</th>
                                        <th width="70px" class="text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php $urut = 1;
                                    foreach ($pengumuman as $p) { ?>
                                        <tr>
                                            <td><?= $urut; ?></td>
                                            <td>
                                                <img width="100px" src="<?= base_url() ?>assets/img/pengumuman/<?= $p->foto; ?>">
                                            </td>
                                            <td><?= $p->judul; ?></td>
                                            <td>
                                                <?php if (empty($p->file)) {
                                                    echo '<a class="btn btn-danger btn-sm" style="color:white">File Not Found</a>';
                                                } else {
                                                    echo '<a class="btn btn-primary btn-sm"style="color:white">Read more</a>';
                                                } ?>
                                            </td>
                                            <td><?= date('d M Y', strtotime($p->tgl)); ?></td>
                                            <td><?= $p->viewer; ?> <i class="fas fa-users"></i></td>
                                            <td>
                                                <a class="btn btn-success btn-sm" href="<?= site_url('Administrator/edit_pengumuman/' . $p->id) ?>"><i class="fas fa-edit"></i></a>
                                                <a class="btn btn-danger btn-sm" href="<?= site_url('Administrator/hapus_pengumuman/' . $p->id) ?>"><i class="fas fa-trash"></i></a>
                                            </td>
                                        </tr>
                                    <?php $urut++;
                                    }    ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</div>